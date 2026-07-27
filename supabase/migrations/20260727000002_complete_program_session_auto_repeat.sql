-- complete_program_session: loop instead of finish when auto_repeat is on.
--
-- Original behavior (20260707000000): recording the final unsatisfied session's
-- completion flips the enrollment to 'completed'. For a repeating workout that is
-- wrong -- the program should start over. When the enrollment has auto_repeat set,
-- satisfying the last session instead RESETS the enrollment's completions (a fresh
-- cycle) and bumps cycles_completed, leaving status 'active'. The completions
-- UNIQUE (user_program_id, program_session_id) guard means we cannot stack a
-- second completion per session, so a reset -- not a duplicate insert -- is how a
-- loop is expressed. Workout history is untouched: each finished session is its own
-- workout_logs row whose "{Program} · W#D# {title}" name is composed at start time,
-- not derived from the completion we delete here.
--
-- Everything else is carried over verbatim from
-- 20260707000000_create_complete_program_session_function.sql.
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
  v_user_id     uuid := auth.uid();
  v_program_id  uuid;
  v_auto_repeat boolean;
  v_total       int;
  v_satisfied   int;
  v_all_done    boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status NOT IN ('completed', 'skipped') THEN
    RAISE EXCEPTION 'Invalid completion status: %', p_status;
  END IF;

  -- Confirm the enrollment is the caller's own and capture its program (the
  -- user-owned clone) and its auto-repeat toggle. RLS also guards this, but the
  -- explicit check yields a clear error and the values in one round trip.
  SELECT program_id, auto_repeat INTO v_program_id, v_auto_repeat
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

  IF v_all_done AND v_auto_repeat THEN
    -- Loop: clear this cycle's completions so the next session resolves back to
    -- sequence_index 0, keep the enrollment active, and record the cycle. Returns
    -- FALSE so the client shows no "program complete" message.
    DELETE FROM program_session_completions
      WHERE user_program_id = p_user_program_id;
    UPDATE user_programs
      SET cycles_completed = cycles_completed + 1
      WHERE id = p_user_program_id;
    RETURN false;
  ELSIF v_all_done THEN
    UPDATE user_programs
      SET status = 'completed', completed_at = NOW()
      WHERE id = p_user_program_id AND status = 'active';
  END IF;

  RETURN v_all_done;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_program_session(uuid, uuid, bigint, text) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_program_session(uuid, uuid, bigint, text) TO authenticated;
