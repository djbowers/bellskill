-- Program Tracking: optional starting weight on enroll (PROD-TBD).
--
-- enroll_in_program's copy-on-enroll previously cloned program_sessions'
-- workout_options verbatim, including DFW's double-24kg placeholder load on
-- every regular session (see 20260706170001_seed_dry_fighting_weight.sql). A
-- user whose real working weight differs had to hand-edit every session for
-- the length of the program. p_starting_weight_kg lets the caller supply a
-- starting weight at enroll time; when set, it's written into the clone's
-- sharedWeightOneValue/sharedWeightTwoValue (both bells, matching DFW's
-- double-kettlebell loading), which resolveSharedWeights.ts already overrides
-- every movement's weight from. NULL (the default) is byte-identical to prior
-- behavior -- existing callers and every other program are unaffected.
--
-- Sessions that already deviate from the shared placeholder default (e.g.
-- DFW's W5D2 "Test a new press max", deliberately seeded heavier at 28kg to
-- test a real press max) are excluded structurally rather than by assumed row
-- order: only sessions whose first movement's weightOneValue matches the
-- *modal* (most common) weight across the source program's sessions are
-- placeholder sessions and get the override.
--
-- DROP + CREATE (not CREATE OR REPLACE): appending a parameter changes the
-- function's argument-type identity, so an in-place replace would leave the
-- old enroll_in_program(uuid) overload around too -- PostgREST would then see
-- two matching candidates for a call passing only p_program_id and error
-- "function is not unique".
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID);

CREATE FUNCTION public.enroll_in_program(
  p_program_id UUID,
  p_starting_weight_kg NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id            UUID := auth.uid();
  v_owner_id           UUID;
  v_is_public          BOOLEAN;
  v_target_program     UUID;
  v_user_program_id    UUID;
  v_placeholder_weight NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- RLS on this SELECT already restricts to public-or-own; a NOT FOUND result
  -- means the program does not exist or is not visible to the caller.
  SELECT owner_id, is_public INTO v_owner_id, v_is_public
  FROM programs WHERE id = p_program_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program % not found or not accessible', p_program_id;
  END IF;

  -- Abandon any existing active enrollment (keeps the partial unique index happy).
  UPDATE user_programs
    SET status = 'abandoned'
    WHERE user_id = v_user_id AND status = 'active';

  IF v_owner_id = v_user_id THEN
    v_target_program := p_program_id;                     -- own program: no clone
  ELSE
    INSERT INTO programs
      (owner_id, source_program_id, slug, title, description, author_name,
       num_weeks, days_per_week, is_public)
    SELECT v_user_id, id, NULL, title, description, author_name,
           num_weeks, days_per_week, false
    FROM programs WHERE id = p_program_id
    RETURNING id INTO v_target_program;

    IF p_starting_weight_kg IS NOT NULL THEN
      SELECT weight_val INTO v_placeholder_weight
      FROM (
        SELECT (workout_options->'movements'->0->>'weightOneValue')::NUMERIC AS weight_val,
               COUNT(*) AS cnt
        FROM program_sessions
        WHERE program_id = p_program_id
        GROUP BY weight_val
        ORDER BY cnt DESC, weight_val
        LIMIT 1
      ) modal;
    END IF;

    INSERT INTO program_sessions
      (program_id, sequence_index, week_number, day_number, title, workout_options, notes)
    SELECT
      v_target_program, sequence_index, week_number, day_number, title,
      CASE
        WHEN p_starting_weight_kg IS NOT NULL
         AND (workout_options->'movements'->0->>'weightOneValue')::NUMERIC = v_placeholder_weight
        THEN jsonb_set(
               jsonb_set(
                 jsonb_set(
                   jsonb_set(workout_options, '{sharedWeightOneValue}', to_jsonb(p_starting_weight_kg)),
                   '{sharedWeightOneUnit}', to_jsonb('kilograms'::TEXT)),
                 '{sharedWeightTwoValue}', to_jsonb(p_starting_weight_kg)),
               '{sharedWeightTwoUnit}', to_jsonb('kilograms'::TEXT))
        ELSE workout_options
      END,
      notes
    FROM program_sessions WHERE program_id = p_program_id
    ORDER BY sequence_index;
  END IF;

  INSERT INTO user_programs (user_id, program_id, status)
  VALUES (v_user_id, v_target_program, 'active')
  RETURNING id INTO v_user_program_id;

  RETURN v_user_program_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_in_program(UUID, NUMERIC) FROM public;
GRANT EXECUTE ON FUNCTION public.enroll_in_program(UUID, NUMERIC) TO authenticated;
