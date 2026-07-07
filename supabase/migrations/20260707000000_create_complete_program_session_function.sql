-- Program Tracking Slice 3: complete_program_session().
--
-- Advances a user's active program by one session: records a completion (or a
-- skip) and, when that satisfies the final unsatisfied session, flips the
-- enrollment to 'completed'. Doing the insert + last-session check + status flip
-- in one plpgsql function makes the advance atomic — a completion never lands
-- without its terminal status flip, and vice versa.
--
--   p_workout_log_id  the real workout_logs.id for a completed session, or NULL
--                     for a skip (status='skipped').
--   p_status          'completed' (default) or 'skipped'.
--
-- Returns TRUE when this call completed the whole program (all sessions now
-- satisfied), else FALSE — the client uses it only for messaging; it invalidates
-- the active-program query either way.
--
-- SECURITY INVOKER (house default, cf. enroll_in_program / pattern_debt_window):
-- every write is permitted by the caller's own RLS — they own the user_programs
-- row and the completions they insert — so no privilege escalation is needed.
CREATE OR REPLACE FUNCTION public.complete_program_session(
  p_user_program_id uuid,
  p_program_session_id uuid,
  p_workout_log_id bigint DEFAULT NULL,
  p_status text DEFAULT 'completed'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_program_id uuid;
  v_total      int;
  v_satisfied  int;
  v_all_done   boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status NOT IN ('completed', 'skipped') THEN
    RAISE EXCEPTION 'Invalid completion status: %', p_status;
  END IF;

  -- Confirm the enrollment is the caller's own and capture its program (the
  -- user-owned clone). RLS also guards this, but the explicit check yields a
  -- clear error and the program_id in one round trip.
  SELECT program_id INTO v_program_id
  FROM user_programs
  WHERE id = p_user_program_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment % not found or not owned by caller', p_user_program_id;
  END IF;

  -- A session is satisfied at most once per enrollment (UNIQUE guard). Make a
  -- duplicate fire (e.g. a double onSuccess, or a retry) a harmless no-op rather
  -- than a unique violation.
  INSERT INTO program_session_completions
    (user_program_id, program_session_id, user_id, workout_log_id, status)
  VALUES
    (p_user_program_id, p_program_session_id, v_user_id, p_workout_log_id, p_status)
  ON CONFLICT (user_program_id, program_session_id) DO NOTHING;

  -- Is every session in the program now satisfied?
  SELECT count(*) INTO v_total
  FROM program_sessions
  WHERE program_id = v_program_id;

  SELECT count(*) INTO v_satisfied
  FROM program_session_completions
  WHERE user_program_id = p_user_program_id;

  v_all_done := v_total > 0 AND v_satisfied >= v_total;

  IF v_all_done THEN
    UPDATE user_programs
      SET status = 'completed', completed_at = NOW()
      WHERE id = p_user_program_id AND status = 'active';
  END IF;

  RETURN v_all_done;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_program_session(uuid, uuid, bigint, text) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_program_session(uuid, uuid, bigint, text) TO authenticated;
