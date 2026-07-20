-- Program Tracking: resume a prior enrollment instead of orphaning it (PROD-237).
--
-- enroll_in_program always INSERTs a fresh user_programs row (see
-- 20260714000001_enroll_in_program_starting_weight.sql:130). Re-entering a
-- program you already have progress in therefore starts from zero and strands
-- the earlier enrollment's program_session_completions on an abandoned row.
-- That is the correct behavior for an explicit "start over", but there was no
-- way to pick up where you left off.
--
-- resume_program is the missing "resume" half. It reactivates the user's most
-- recent non-active enrollment in the target program (flipping it back to
-- `active` and clearing completed_at) so its completions come back with it. It
-- is a separate function rather than a new enroll_in_program parameter on
-- purpose: adding an overload would make a p_program_id-only call ambiguous to
-- PostgREST ("function is not unique"), and enroll_in_program's proven
-- copy-on-enroll / start-over path stays untouched.
--
-- Enrollment-lifecycle only: no clone, no schema change, no RLS change, and no
-- re-key of existing rows (a single status/completed_at UPDATE on one row the
-- caller already owns), so there is nothing to survival-count. SECURITY INVOKER,
-- matching enroll_in_program — the caller's own RLS already permits the reads
-- and the update to their own user_programs.
CREATE OR REPLACE FUNCTION public.resume_program(p_program_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id         UUID := auth.uid();
  v_user_program_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Free the partial unique index before flipping the target back to active.
  UPDATE user_programs
    SET status = 'abandoned'
    WHERE user_id = v_user_id
      AND status = 'active'
      AND program_id <> p_program_id;

  -- Most-recent non-active enrollment in this program: the one to bring back.
  SELECT id INTO v_user_program_id
  FROM user_programs
  WHERE user_id = v_user_id
    AND program_id = p_program_id
    AND status <> 'active'
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_user_program_id IS NULL THEN
    RAISE EXCEPTION 'No resumable enrollment for program %', p_program_id;
  END IF;

  UPDATE user_programs
    SET status = 'active', completed_at = NULL
    WHERE id = v_user_program_id;

  RETURN v_user_program_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resume_program(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.resume_program(UUID) TO authenticated;
