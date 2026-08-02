-- Move an active enrollment to a stage on its program's ladder.
--
-- Rewrites every session of the enrollment's cloned program that has no
-- completion row for this enrollment (same scope as adjust_program_weights):
--
--   * title            -> the stage's title, prefixed 'Deload · ' on rows in
--                         the 'Deload weeks' weight group.
--   * movements        -> the stage's movements (name + repScheme), each
--                         stamped with THAT session's own sharedWeightOne/Two
--                         pair — so 24 kg work sessions and 16 kg deloads both
--                         keep their loads across a stage change, and
--                         adjust_program_weights remains the sole weight
--                         authority.
--   * preWorkoutNotes  -> the stage's notes (deloadPreWorkoutNotes on deload
--                         rows), falling back to the session's existing note
--                         when the stage doesn't author one.
--
-- The `||` merge leaves goal, duration, interval, and rest untouched.
-- Completed sessions are never rewritten — history shows what was done at the
-- stage it was done. Takes an absolute index so one function serves both
-- "advance" and "go back". Stages v1 assumes shared-weight (complexSet)
-- programs; the only ladder shipped is A+A.
CREATE FUNCTION public.set_program_stage(
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
  SET title = CASE WHEN ps.weight_label = 'Deload weeks'
                   THEN 'Deload · ' || (v_stage->>'title')
                   ELSE v_stage->>'title' END,
      workout_options = ps.workout_options || jsonb_build_object(
        'movements', (
          SELECT jsonb_agg(
                   m || jsonb_build_object(
                     'weightOneUnit',  ps.workout_options->'sharedWeightOneUnit',
                     'weightOneValue', ps.workout_options->'sharedWeightOneValue',
                     'weightTwoUnit',  ps.workout_options->'sharedWeightTwoUnit',
                     'weightTwoValue', ps.workout_options->'sharedWeightTwoValue')
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

REVOKE ALL ON FUNCTION public.set_program_stage(UUID, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.set_program_stage(UUID, INTEGER) TO authenticated;
