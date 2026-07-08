-- Program Tracking: reorder + delete program sessions (owner-editable programs).
--
-- The manual program builder (Slice 2) could ADD sessions but not reorder or
-- delete them. These two SECURITY INVOKER RPCs add both, safely.
--
-- WHY RPCs: program_sessions has UNIQUE (program_id, sequence_index) which is
-- NOT DEFERRABLE. A naive client-side permutation of sequence_index (e.g. swap
-- two adjacent rows with two plain UPDATEs) transiently duplicates an index and
-- violates the constraint mid-statement. Each RPC reindexes inside ONE
-- transaction using a temp offset: bump every affected row to
-- sequence_index + offset (offset > current MAX index, so a bumped row never
-- collides with an as-yet-unbumped one), then assign the final contiguous
-- 0..N-1 values. No intermediate state ever duplicates an index.
--
-- WHY relabel week/day: for a hand-built program the Week/Day labels must stay
-- coherent with the (new) order, exactly as the ADD path derives them from the
-- program's days_per_week (nextWeek = floor(seq/dpw)+1, nextDay = seq%dpw + 1,
-- see ProgramSessionBuilderPage). Both RPCs recompute week_number/day_number
-- from the final contiguous sequence_index, so next-workout surfacing
-- (useActiveProgram) and the progress view (useProgramProgress) — which order by
-- sequence_index and group by week_number — stay correct. Session ids are
-- stable across a reorder, so program_session_completions rows keep pointing at
-- the right session; deleting a session cascades its completion
-- (program_session_completions.program_session_id ON DELETE CASCADE).
--
-- SECURITY INVOKER (house default, cf. enroll_in_program /
-- complete_program_session): every write is gated by the caller's own RLS on
-- program_sessions — the "... of own programs" policies restrict UPDATE/DELETE
-- to programs where programs.owner_id = auth.uid() — so no privilege escalation
-- is needed and the shared/read-only DFW template can never be reindexed by a
-- non-owner.

-- ── reorder_program_sessions(): impose an explicit order, relabel, reindex ────
-- p_ordered_ids must be a permutation of exactly this program's session ids
-- (same length, every id belongs to the program, no duplicates); the sessions
-- are reassigned sequence_index 0..N-1 in that array order.
CREATE OR REPLACE FUNCTION public.reorder_program_sessions(
  p_program_id uuid,
  p_ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_owner_id uuid;
  v_dpw      int;
  v_count    int;
  v_offset   int;
  v_seq      int := 0;
  v_id       uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id, GREATEST(COALESCE(days_per_week, 1), 1)
    INTO v_owner_id, v_dpw
  FROM programs WHERE id = p_program_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program % not found or not accessible', p_program_id;
  END IF;

  -- Owner-only. Mirrors the RLS UPDATE policy, but checked explicitly so a
  -- non-owner (who can still SELECT a public program) gets a clear error rather
  -- than a silent 0-row reindex.
  IF v_owner_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Not permitted to reorder sessions of program % (not owner)', p_program_id;
  END IF;

  -- The array must be a permutation of exactly this program's session ids.
  SELECT count(*) INTO v_count FROM program_sessions WHERE program_id = p_program_id;
  IF v_count <> COALESCE(array_length(p_ordered_ids, 1), 0) THEN
    RAISE EXCEPTION 'Ordered id list length (%) does not match session count (%) for program %',
      COALESCE(array_length(p_ordered_ids, 1), 0), v_count, p_program_id;
  END IF;
  IF v_count <> (
    SELECT count(DISTINCT ps.id)
    FROM program_sessions ps
    WHERE ps.program_id = p_program_id AND ps.id = ANY(p_ordered_ids)
  ) THEN
    RAISE EXCEPTION 'Ordered id list contains unknown or duplicate session ids for program %', p_program_id;
  END IF;

  IF v_count = 0 THEN
    RETURN;
  END IF;

  -- Temp offset beyond the current max index (constraint is NOT deferrable).
  SELECT COALESCE(MAX(sequence_index), 0) + 1 INTO v_offset
  FROM program_sessions WHERE program_id = p_program_id;

  UPDATE program_sessions
    SET sequence_index = sequence_index + v_offset
    WHERE program_id = p_program_id;

  -- Assign final contiguous 0..N-1 in array order, relabeling week/day.
  FOREACH v_id IN ARRAY p_ordered_ids LOOP
    UPDATE program_sessions
      SET sequence_index = v_seq,
          week_number = (v_seq / v_dpw) + 1,
          day_number = (v_seq % v_dpw) + 1
      WHERE id = v_id AND program_id = p_program_id;
    v_seq := v_seq + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_program_sessions(uuid, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.reorder_program_sessions(uuid, uuid[]) TO authenticated;

-- ── delete_program_session(): delete one session, compact + relabel the rest ──
-- Deletes the target session then reindexes the remaining sessions to a
-- contiguous 0..N-1 (relabeling week/day), so no gap is left. Closing the gap
-- keeps the builder's ADD path valid — it computes the next index as
-- sessions.length, which would otherwise collide with a surviving higher index.
CREATE OR REPLACE FUNCTION public.delete_program_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_program_id uuid;
  v_dpw        int;
  v_offset     int;
  v_seq        int := 0;
  v_id         uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- The session's program + days_per_week (RLS on this SELECT restricts to
  -- readable programs).
  SELECT ps.program_id, GREATEST(COALESCE(p.days_per_week, 1), 1)
    INTO v_program_id, v_dpw
  FROM program_sessions ps
  JOIN programs p ON p.id = ps.program_id
  WHERE ps.id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program session % not found or not accessible', p_session_id;
  END IF;

  -- Delete the target. The RLS DELETE policy rejects non-owners (0 rows), so
  -- guard FOUND to raise a clear error rather than silently reindexing.
  DELETE FROM program_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not permitted to delete session % (not program owner)', p_session_id;
  END IF;

  -- Compact the survivors to 0..N-1 in current order, relabeling week/day. Temp
  -- offset beyond current max index avoids the NOT-DEFERRABLE unique collision.
  SELECT COALESCE(MAX(sequence_index), 0) + 1 INTO v_offset
  FROM program_sessions WHERE program_id = v_program_id;

  UPDATE program_sessions
    SET sequence_index = sequence_index + v_offset
    WHERE program_id = v_program_id;

  FOR v_id IN
    SELECT id FROM program_sessions
    WHERE program_id = v_program_id
    ORDER BY sequence_index
  LOOP
    UPDATE program_sessions
      SET sequence_index = v_seq,
          week_number = (v_seq / v_dpw) + 1,
          day_number = (v_seq % v_dpw) + 1
      WHERE id = v_id;
    v_seq := v_seq + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_program_session(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_program_session(uuid) TO authenticated;
