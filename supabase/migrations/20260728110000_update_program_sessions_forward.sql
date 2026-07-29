-- Program Tracking: apply an edited session's movements to all later sessions.
--
-- Session editing rewrites one program_sessions row in place
-- (useUpdateProgramSession), but a lifter mid-program who changes a movement —
-- e.g. C+J to C+J+C in A+A Plan A — wants every UPCOMING session to carry the
-- change without restarting the program. Enrollment clones the program
-- (enroll_in_program), so the caller owns every affected row.
--
-- Scope and semantics:
--   * Targets sessions of the same program with sequence_index > the edited
--     session's, skipping any the caller has already completed (a
--     program_session_completions row via one of their enrollments) — same
--     never-touch-completed rule as adjust_program_weights.
--   * p_forward_options is jsonb-merged (||) into each session's
--     workout_options. The client sends only the "what you do" keys
--     (movements, sharedWeightOne/Two value+unit, complexSet), so each future
--     session keeps its own title, notes, goal, duration, and rest settings —
--     authored periodization survives the swap.
--
-- SECURITY INVOKER (house default): the UPDATE is additionally gated by the
-- caller's own "... update sessions of own programs" RLS policy; ownership is
-- also checked explicitly for a clear error instead of a silent 0-row update.
--
-- Returns the number of later sessions rewritten.
CREATE FUNCTION public.update_program_sessions_forward(
  p_session_id      UUID,
  p_forward_options JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_program_id UUID;
  v_seq        INT;
  v_owner_id   UUID;
  v_updated    INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_forward_options IS NULL OR p_forward_options = '{}'::jsonb THEN
    RAISE EXCEPTION 'No options provided';
  END IF;

  SELECT ps.program_id, ps.sequence_index, p.owner_id
    INTO v_program_id, v_seq, v_owner_id
  FROM program_sessions ps
  JOIN programs p ON p.id = ps.program_id
  WHERE ps.id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program session % not found or not accessible', p_session_id;
  END IF;

  IF v_owner_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Not permitted to update sessions of this program (not owner)';
  END IF;

  UPDATE program_sessions ps
  SET workout_options = ps.workout_options || p_forward_options
  WHERE ps.program_id = v_program_id
    AND ps.sequence_index > v_seq
    AND NOT EXISTS (
      SELECT 1
      FROM program_session_completions c
      JOIN user_programs up ON up.id = c.user_program_id
      WHERE c.program_session_id = ps.id
        AND up.user_id = v_user_id
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.update_program_sessions_forward(UUID, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.update_program_sessions_forward(UUID, JSONB) TO authenticated;
