-- Generalize set_program_stage beyond shared-weight complexSet programs.
--
-- v1 stamped every stage movement with the session's sharedWeightOne/Two —
-- correct for A+A, wrong for non-complex programs like Strong Endurance Plan
-- 025, whose shared weights are NULL and whose loads live on each movement.
-- Now the weight source is decided per session:
--
--   * complexSet with non-null sharedWeightOneValue -> shared-weight stamping,
--     exactly as before (A+A work and deload sessions are unchanged).
--   * otherwise -> each stage movement inherits the weight fields of the
--     session's existing movement with the same movementName (preserving
--     e.g. weightTwoValue 0 = one-handed mode), falling back to null weights
--     for a movement the session did not have.
--
-- On that non-shared path the session also keeps its own title: A+A's titles
-- ARE the complex, but a program like 025 uses titles as structural day labels
-- ('High volume' / 'Medium volume' / 'Low volume') that a stage must not
-- clobber — the enrollment's current rung is visible on the StageCard.
-- Notes, scope (uncompleted sessions of the enrollment's clone only), and the
-- goal/duration/interval/rest passthrough are unchanged.
CREATE OR REPLACE FUNCTION public.set_program_stage(
  p_user_program_id UUID,
  p_stage_index     INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_program UUID;
  v_stages  JSONB;
  v_stage   JSONB;
  v_updated INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT up.program_id, p.stages INTO v_program, v_stages
  FROM user_programs up
  JOIN programs p ON p.id = up.program_id
  WHERE up.id = p_user_program_id
    AND up.user_id = v_user_id
    AND up.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active enrollment % for this user', p_user_program_id;
  END IF;
  IF v_stages IS NULL OR jsonb_typeof(v_stages) <> 'array' THEN
    RAISE EXCEPTION 'PROGRAM_HAS_NO_STAGES';
  END IF;
  IF p_stage_index < 0 OR p_stage_index >= jsonb_array_length(v_stages) THEN
    RAISE EXCEPTION 'STAGE_INDEX_OUT_OF_RANGE';
  END IF;

  v_stage := v_stages -> p_stage_index;

  UPDATE program_sessions ps
  SET title = CASE
        WHEN NOT (COALESCE((ps.workout_options->>'complexSet')::boolean, false)
                  AND ps.workout_options->'sharedWeightOneValue' IS NOT NULL
                  AND ps.workout_options->'sharedWeightOneValue' <> 'null'::jsonb)
          THEN ps.title
        WHEN ps.weight_label = 'Deload weeks'
          THEN 'Deload · ' || (v_stage->>'title')
        ELSE v_stage->>'title' END,
      workout_options = ps.workout_options || jsonb_build_object(
        'movements', (
          SELECT jsonb_agg(
                   m || CASE
                     WHEN COALESCE((ps.workout_options->>'complexSet')::boolean, false)
                          AND ps.workout_options->'sharedWeightOneValue' IS NOT NULL
                          AND ps.workout_options->'sharedWeightOneValue' <> 'null'::jsonb
                     THEN jsonb_build_object(
                            'weightOneUnit',  ps.workout_options->'sharedWeightOneUnit',
                            'weightOneValue', ps.workout_options->'sharedWeightOneValue',
                            'weightTwoUnit',  ps.workout_options->'sharedWeightTwoUnit',
                            'weightTwoValue', ps.workout_options->'sharedWeightTwoValue')
                     ELSE COALESCE(
                       (SELECT jsonb_build_object(
                                 'weightOneUnit',  em->'weightOneUnit',
                                 'weightOneValue', em->'weightOneValue',
                                 'weightTwoUnit',  em->'weightTwoUnit',
                                 'weightTwoValue', em->'weightTwoValue')
                        FROM jsonb_array_elements(ps.workout_options->'movements') em
                        WHERE em->>'movementName' = m->>'movementName'
                        LIMIT 1),
                       jsonb_build_object(
                         'weightOneUnit',  NULL, 'weightOneValue', NULL,
                         'weightTwoUnit',  NULL, 'weightTwoValue', NULL))
                   END
                   ORDER BY ord)
          FROM jsonb_array_elements(v_stage->'movements')
                 WITH ORDINALITY AS e(m, ord)),
        'preWorkoutNotes', COALESCE(
          CASE WHEN ps.weight_label = 'Deload weeks'
               THEN v_stage->>'deloadPreWorkoutNotes' END,
          v_stage->>'preWorkoutNotes',
          ps.workout_options->>'preWorkoutNotes'))
  WHERE ps.program_id = v_program
    AND NOT EXISTS (
      SELECT 1 FROM program_session_completions c
      WHERE c.user_program_id = p_user_program_id
        AND c.program_session_id = ps.id
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE user_programs
  SET current_stage_index = p_stage_index
  WHERE id = p_user_program_id;

  RETURN v_updated;
END;
$$;
