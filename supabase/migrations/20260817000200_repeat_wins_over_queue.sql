-- Repeating programs win over the queue, and can be restarted after the fact.
--
-- 1) complete_program_session: auto_repeat is now checked BEFORE queue
--    promotion. A repeating program is a standing loop the user opted into;
--    completing it out from under them because something sat in the queue left
--    them stuck on a "Program complete" card with no way to repeat. The queue
--    now promotes only when a non-repeating program finishes.
--
-- 2) set_program_auto_repeat: enabling repeat used to matter only at the
--    moment the final session completed. Enrollments already 'completed' could
--    never loop again. This RPC makes the toggle transactional: flipping it on
--    for a completed enrollment restarts it at session 1 (completions cleared,
--    cycle counted, re-slotted).
--
-- complete_program_session body otherwise carried over verbatim from
-- 20260728100002_complete_program_session_queue.sql.
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
  v_slot        smallint;
  v_next_id     uuid;
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
  -- user-owned clone), its auto-repeat toggle, and the slot it would free.
  -- RLS also guards this, but the explicit check yields a clear error and the
  -- values in one round trip.
  SELECT program_id, auto_repeat, active_slot
  INTO v_program_id, v_auto_repeat, v_slot
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
    IF v_auto_repeat THEN
      -- Loop: clear this cycle's completions so the next session resolves back
      -- to sequence_index 0, keep the enrollment active, and record the cycle.
      -- Returns FALSE so the client shows no "program complete" message.
      DELETE FROM program_session_completions
        WHERE user_program_id = p_user_program_id;
      UPDATE user_programs
        SET cycles_completed = cycles_completed + 1
        WHERE id = p_user_program_id;
      RETURN false;
    END IF;

    SELECT id INTO v_next_id
    FROM user_programs
    WHERE user_id = v_user_id AND status = 'queued'
    ORDER BY queue_position
    LIMIT 1
    FOR UPDATE;

    -- Complete the finisher first so its slot is free for a promotion
    -- (one_program_per_active_slot ignores non-active rows).
    UPDATE user_programs
      SET status = 'completed', completed_at = NOW()
      WHERE id = p_user_program_id AND status = 'active';

    IF v_next_id IS NOT NULL THEN
      UPDATE user_programs
        SET status = 'active', active_slot = v_slot, queue_position = NULL,
            started_at = NOW()
        WHERE id = v_next_id;
    END IF;
  END IF;

  RETURN v_all_done;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_program_session(uuid, uuid, bigint, text) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_program_session(uuid, uuid, bigint, text) TO authenticated;

-- set_program_auto_repeat: flip the toggle; restart a completed enrollment.
-- The restart (clear completions + reactivate + count the cycle) must be
-- atomic, hence an RPC rather than client-side queries.
CREATE OR REPLACE FUNCTION public.set_program_auto_repeat(
  p_user_program_id uuid,
  p_auto_repeat boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_status  text;
  v_slot    smallint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT status INTO v_status
  FROM user_programs
  WHERE id = p_user_program_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment % not found or not owned by caller', p_user_program_id;
  END IF;

  UPDATE user_programs
    SET auto_repeat = p_auto_repeat
    WHERE id = p_user_program_id;

  IF p_auto_repeat AND v_status = 'completed' THEN
    -- The enrollment's old active_slot may since have been taken by another
    -- program; claim the lowest free slot instead.
    SELECT s INTO v_slot
    FROM generate_series(1, 3) AS s
    WHERE NOT EXISTS (
      SELECT 1 FROM user_programs
      WHERE user_id = v_user_id AND status = 'active' AND active_slot = s
    )
    ORDER BY s
    LIMIT 1;
    IF v_slot IS NULL THEN
      RAISE EXCEPTION 'All program slots are full. Finish or pause a program to restart this one.';
    END IF;

    DELETE FROM program_session_completions
      WHERE user_program_id = p_user_program_id;
    UPDATE user_programs
      SET status = 'active', active_slot = v_slot, completed_at = NULL,
          queue_position = NULL, cycles_completed = cycles_completed + 1
      WHERE id = p_user_program_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_program_auto_repeat(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.set_program_auto_repeat(uuid, boolean) TO authenticated;
