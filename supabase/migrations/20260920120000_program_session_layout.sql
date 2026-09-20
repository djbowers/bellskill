-- Program builder: explicit session layout (drag-and-drop + week CRUD).
--
-- week_number / day_number become the source of truth for a session's place in
-- a program; sequence_index is derived as the 0-based rank by (week, day). The
-- previous reorder/delete RPCs relabeled week/day from programs.days_per_week
-- (1 for hand-built programs), which flattened every session into its own week
-- and made cross-week moves impossible to express.
--
-- Every write path here leaves weeks contiguous 1..W and days contiguous
-- 1..D_w per week. Reindexing still goes through the temp-offset trick because
-- UNIQUE (program_id, sequence_index) is NOT DEFERRABLE: bump every row past the
-- current MAX, then assign final values, so no intermediate state collides.
--
-- All functions are SECURITY INVOKER with an explicit owner check (house style,
-- cf. 20260708000000_reorder_delete_program_sessions.sql).

-- ── compact_program_sessions(): normalize week/day/sequence ──────────────────
-- No-op on consistent data. Closes week gaps (dense_rank), renumbers days
-- within each week, and ranks sequence_index by (week, day). Also clears the
-- program's stored cadence so it is derived from sessions from now on: user
-- copies cloned by enroll_in_program inherit the seeded cadence, which would go
-- stale the moment a week is added or removed.
CREATE OR REPLACE FUNCTION public.compact_program_sessions(p_program_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_owner_id uuid;
  v_offset   int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id INTO v_owner_id FROM programs WHERE id = p_program_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program % not found or not accessible', p_program_id;
  END IF;
  IF v_owner_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Not permitted to edit sessions of program % (not owner)', p_program_id;
  END IF;

  SELECT COALESCE(MAX(sequence_index), 0) + 1 INTO v_offset
  FROM program_sessions WHERE program_id = p_program_id;

  UPDATE program_sessions
    SET sequence_index = sequence_index + v_offset
    WHERE program_id = p_program_id;

  UPDATE program_sessions ps
    SET sequence_index = n.seq,
        week_number = n.week,
        day_number = n.day
    FROM (
      SELECT id,
             row_number() OVER (ORDER BY week_number, day_number, sequence_index) - 1 AS seq,
             dense_rank() OVER (ORDER BY week_number) AS week,
             row_number() OVER (PARTITION BY week_number ORDER BY day_number, sequence_index) AS day
      FROM program_sessions
      WHERE program_id = p_program_id
    ) n
    WHERE ps.id = n.id;

  UPDATE programs
    SET num_weeks = NULL, days_per_week = NULL
    WHERE id = p_program_id
      AND (num_weeks IS NOT NULL OR days_per_week IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.compact_program_sessions(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.compact_program_sessions(uuid) TO authenticated;

-- ── set_program_session_layout(): write an explicit week/day per session ─────
-- p_layout is a JSON array of {id, week_number, day_number} covering exactly the
-- program's sessions. Array order is ignored; sequence_index is ranked by
-- (week, day). Weeks must be contiguous 1..W and days contiguous 1..D per week.
CREATE OR REPLACE FUNCTION public.set_program_session_layout(
  p_program_id uuid,
  p_layout jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_owner_id uuid;
  v_count    int;
  v_offset   int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id INTO v_owner_id FROM programs WHERE id = p_program_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program % not found or not accessible', p_program_id;
  END IF;
  IF v_owner_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Not permitted to edit sessions of program % (not owner)', p_program_id;
  END IF;

  IF p_layout IS NULL OR jsonb_typeof(p_layout) <> 'array' THEN
    RAISE EXCEPTION 'Layout must be a JSON array of {id, week_number, day_number}';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_layout) AS x(id uuid, week_number int, day_number int)
    WHERE x.id IS NULL OR x.week_number IS NULL OR x.day_number IS NULL
       OR x.week_number < 1 OR x.day_number < 1
  ) THEN
    RAISE EXCEPTION 'Layout entries need an id and week/day numbers >= 1';
  END IF;

  SELECT count(*) INTO v_count FROM program_sessions WHERE program_id = p_program_id;
  IF v_count <> (SELECT count(*) FROM jsonb_array_elements(p_layout)) THEN
    RAISE EXCEPTION 'Layout length (%) does not match session count (%) for program %',
      (SELECT count(*) FROM jsonb_array_elements(p_layout)), v_count, p_program_id;
  END IF;
  IF v_count <> (
    SELECT count(DISTINCT ps.id)
    FROM program_sessions ps
    JOIN jsonb_to_recordset(p_layout) AS x(id uuid, week_number int, day_number int)
      ON x.id = ps.id
    WHERE ps.program_id = p_program_id
  ) THEN
    RAISE EXCEPTION 'Layout contains unknown or duplicate session ids for program %', p_program_id;
  END IF;

  IF v_count = 0 THEN
    RETURN;
  END IF;

  IF (
    SELECT min(week_number) <> 1 OR count(DISTINCT week_number) <> max(week_number)
    FROM jsonb_to_recordset(p_layout) AS x(id uuid, week_number int, day_number int)
  ) THEN
    RAISE EXCEPTION 'Layout weeks must be contiguous from 1';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_layout) AS x(id uuid, week_number int, day_number int)
    GROUP BY week_number
    HAVING min(day_number) <> 1
        OR count(DISTINCT day_number) <> count(*)
        OR count(*) <> max(day_number)
  ) THEN
    RAISE EXCEPTION 'Layout days must be contiguous from 1 within each week';
  END IF;

  SELECT COALESCE(MAX(sequence_index), 0) + 1 INTO v_offset
  FROM program_sessions WHERE program_id = p_program_id;

  UPDATE program_sessions
    SET sequence_index = sequence_index + v_offset
    WHERE program_id = p_program_id;

  UPDATE program_sessions ps
    SET sequence_index = l.seq,
        week_number = l.week_number,
        day_number = l.day_number
    FROM (
      SELECT id, week_number, day_number,
             row_number() OVER (ORDER BY week_number, day_number) - 1 AS seq
      FROM jsonb_to_recordset(p_layout) AS x(id uuid, week_number int, day_number int)
    ) l
    WHERE ps.id = l.id AND ps.program_id = p_program_id;

  UPDATE programs
    SET num_weeks = NULL, days_per_week = NULL
    WHERE id = p_program_id
      AND (num_weeks IS NOT NULL OR days_per_week IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.set_program_session_layout(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.set_program_session_layout(uuid, jsonb) TO authenticated;

-- ── delete_program_session(): delete one session, then compact ───────────────
CREATE OR REPLACE FUNCTION public.delete_program_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_program_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT program_id INTO v_program_id FROM program_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program session % not found or not accessible', p_session_id;
  END IF;

  -- The RLS DELETE policy rejects non-owners (0 rows); guard FOUND for a clear error.
  DELETE FROM program_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not permitted to delete session % (not program owner)', p_session_id;
  END IF;

  PERFORM compact_program_sessions(v_program_id);
END;
$$;

-- ── delete_program_week(): delete every session in a week, then compact ──────
-- Returns the number of sessions deleted. Later weeks renumber down by one.
CREATE OR REPLACE FUNCTION public.delete_program_week(
  p_program_id uuid,
  p_week_number int
)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_owner_id uuid;
  v_deleted  int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id INTO v_owner_id FROM programs WHERE id = p_program_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program % not found or not accessible', p_program_id;
  END IF;
  IF v_owner_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Not permitted to edit sessions of program % (not owner)', p_program_id;
  END IF;

  DELETE FROM program_sessions
    WHERE program_id = p_program_id AND week_number = p_week_number;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN
    RAISE EXCEPTION 'Week % of program % has no sessions', p_week_number, p_program_id;
  END IF;

  PERFORM compact_program_sessions(p_program_id);
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_program_week(uuid, int) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_program_week(uuid, int) TO authenticated;

-- The builder now sends explicit layouts; nothing calls the permutation RPC.
DROP FUNCTION IF EXISTS public.reorder_program_sessions(uuid, uuid[]);
