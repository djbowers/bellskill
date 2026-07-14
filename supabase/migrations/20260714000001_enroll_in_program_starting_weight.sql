-- Program Tracking: optional starting weight on enroll (PROD-TBD).
--
-- enroll_in_program's copy-on-enroll previously cloned program_sessions'
-- workout_options verbatim, including DFW's double-24kg placeholder load on
-- every regular session (see 20260706170001_seed_dry_fighting_weight.sql). A
-- user whose real working weight differs had to hand-edit every session for
-- the length of the program. The four p_shared_weight_* params let the caller
-- supply a starting shared weight at enroll time -- matching the same
-- sharedWeightOne/Two value+unit shape resolveSharedWeights.ts already reads,
-- so the enrollee can pick two-hand / single / double loading, independent
-- left/right (mixed) weights, and kg or lb. When set, they're written into the
-- clone's sharedWeightOne/TwoValue/Unit, which resolveSharedWeights.ts then
-- overrides every movement's weight from. Leaving them NULL (the default) is
-- byte-identical to prior behavior -- existing callers and every other program
-- are unaffected.
--
-- The override is keyed off p_shared_weight_one_value: NULL there means "no
-- override" (e.g. a bodyweight selection), so the clone is verbatim. A NULL
-- p_shared_weight_two_value writes JSON null into sharedWeightTwoValue (two-hand
-- loading); 0 writes a single/offset (1H) slot -- both mirror the live builder.
--
-- Sessions that already deviate from the shared placeholder default (e.g.
-- DFW's W5D2 "Test a new press max", deliberately seeded heavier at 28kg to
-- test a real press max) are excluded structurally rather than by assumed row
-- order: only sessions whose first movement's weightOneValue matches the
-- *modal* (most common) weight across the source program's sessions are
-- placeholder sessions and get the override.
--
-- DROP + CREATE (not CREATE OR REPLACE): the base enroll_in_program(uuid)
-- overload must go, or PostgREST would see two candidates for a call passing
-- only p_program_id (the new all-defaults overload also matches) and error
-- "function is not unique". The new 5-param signature is dropped too so this
-- migration is idempotent on any environment where a prior (later reverted)
-- deploy already created it -- CREATE FUNCTION alone errors 42723 there.
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID);
DROP FUNCTION IF EXISTS public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT);

CREATE FUNCTION public.enroll_in_program(
  p_program_id UUID,
  p_shared_weight_one_value NUMERIC DEFAULT NULL,
  p_shared_weight_one_unit  TEXT    DEFAULT NULL,
  p_shared_weight_two_value NUMERIC DEFAULT NULL,
  p_shared_weight_two_unit  TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id            UUID    := auth.uid();
  v_owner_id           UUID;
  v_target_program     UUID;
  v_user_program_id    UUID;
  v_placeholder_weight NUMERIC;
  v_override           BOOLEAN := p_shared_weight_one_value IS NOT NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- RLS on this SELECT already restricts to public-or-own; a NOT FOUND result
  -- means the program does not exist or is not visible to the caller.
  SELECT owner_id INTO v_owner_id
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

    IF v_override THEN
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
        WHEN v_override
         AND (v_placeholder_weight IS NULL
              OR (workout_options->'movements'->0->>'weightOneValue')::NUMERIC = v_placeholder_weight)
        -- COALESCE(..., 'null'::jsonb): jsonb_set is strict and to_jsonb(NULL)
        -- is SQL NULL, so an unset slot (e.g. weight two in two-hand loading)
        -- must be coerced to a JSON null or the whole workout_options nulls out.
        THEN jsonb_set(
               jsonb_set(
                 jsonb_set(
                   jsonb_set(
                     workout_options,
                     '{sharedWeightOneValue}',
                     COALESCE(to_jsonb(p_shared_weight_one_value), 'null'::jsonb)),
                   '{sharedWeightOneUnit}',
                   COALESCE(to_jsonb(p_shared_weight_one_unit), 'null'::jsonb)),
                 '{sharedWeightTwoValue}',
                 COALESCE(to_jsonb(p_shared_weight_two_value), 'null'::jsonb)),
               '{sharedWeightTwoUnit}',
               COALESCE(to_jsonb(p_shared_weight_two_unit), 'null'::jsonb))
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

REVOKE ALL ON FUNCTION public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.enroll_in_program(UUID, NUMERIC, TEXT, NUMERIC, TEXT) TO authenticated;
