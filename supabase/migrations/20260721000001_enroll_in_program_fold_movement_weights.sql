-- Program Tracking: fold the enroll starting weight onto per-movement weights.
--
-- 20260714000001_enroll_in_program_starting_weight.sql wrote the enrollee's
-- chosen weight only into each cloned session's sharedWeightOne/TwoValue/Unit,
-- on the (mistaken) premise that resolveSharedWeights.ts overrides every
-- movement's weight from those fields at start time. It does not: sharedWeight*
-- is a complexSet-only concept. For a complexSet:false program (Dry Fighting
-- Weight etc.) weights live per-movement in movements[i].weightOne/TwoValue, and
-- both the builder review screen and ActiveWorkoutPage read those directly. So
-- the enroll override was inert -- the workout ran at the seed's placeholder
-- load (double 24kg) no matter what the enrollee picked.
--
-- Fix at the source: also fold the chosen weight onto every movement's
-- per-movement weight fields in the overridden sessions, so a cloned session is
-- immediately runnable in the shape the runtime already reads. sharedWeight* is
-- still written (the complex-set path -- e.g. Armor Building Complex -- reads it
-- via ComplexMovementDisplay; it is harmless and self-healing on non-complex
-- sessions). No client change is needed.
--
-- Which sessions get overridden is unchanged: only sessions whose first
-- movement's weightOneValue matches the *modal* weight across the source
-- program (so DFW's deliberately heavier W5D2 test day is left as authored).
-- A NULL weight-two folds JSON null onto each movement (double -> two-hand),
-- mirroring the sharedWeight* behavior.
--
-- DROP + CREATE (forward-only, idempotent) mirrors the prior migration.
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
        --
        -- The outermost jsonb_set rebuilds {movements}, folding the chosen weight
        -- onto every movement (the shape ActiveWorkoutPage / the builder read for
        -- non-complex sessions); the inner four set sharedWeight* (the complex
        -- path). `m || jsonb_build_object(...)` overrides only the four weight
        -- keys, preserving movementName / repScheme / etc.
        THEN jsonb_set(
               jsonb_set(
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
                 COALESCE(to_jsonb(p_shared_weight_two_unit), 'null'::jsonb)),
               '{movements}',
               (
                 SELECT jsonb_agg(
                          m || jsonb_build_object(
                            'weightOneValue', COALESCE(to_jsonb(p_shared_weight_one_value), 'null'::jsonb),
                            'weightOneUnit',  COALESCE(to_jsonb(p_shared_weight_one_unit),  'null'::jsonb),
                            'weightTwoValue', COALESCE(to_jsonb(p_shared_weight_two_value), 'null'::jsonb),
                            'weightTwoUnit',  COALESCE(to_jsonb(p_shared_weight_two_unit),  'null'::jsonb)
                          )
                        )
                 FROM jsonb_array_elements(workout_options->'movements') AS m
               ))
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
