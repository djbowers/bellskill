-- One user_movements row per lifter per catalog movement, named after the catalog.
--
-- The PROD-234/239/242 relinks set functional_movement_id on lifter-typed names
-- but left canonical_name as authored. Picking the same movement from the
-- catalog later inserted a SECOND row under the catalog name (the app reused
-- rows by name only), so the picker showed two "front squats" and the lifter's
-- history split across them. Logs link to user_movements by canonical_name
-- (useLogWorkout), so the stored name must equal the name the picker offers —
-- which is now always the catalog name. This migration:
--
--   1. merges rows sharing (user_id, functional_movement_id) into one survivor,
--      repointing movement_logs first (the only FK to user_movements);
--   2. renames every linked row to its catalog movement's name;
--   3. rewrites the stored movementName in the lifter's own program_sessions
--      so the next logged session still finds its row;
--   4. adds a partial unique index so the duplicate cannot come back.
--
-- Idempotent: a re-run matches nothing. Counts surface via RAISE NOTICE.

DO $$
DECLARE
  v_logs_repointed   INT;
  v_rows_deleted     INT;
  v_rows_renamed     INT;
  v_sessions_fixed   INT;
BEGIN
  -- Every linked name that is about to change — including rows step 1 deletes —
  -- so step 3 can follow them into program_sessions.
  CREATE TEMP TABLE renamed_rows ON COMMIT DROP AS
  SELECT DISTINCT u.user_id, u.canonical_name AS old_name, m."Movement" AS new_name
  FROM public.user_movements u
  JOIN public.movements m ON m.id = u.functional_movement_id
  WHERE u.canonical_name <> m."Movement";

  -- 1. Survivor per (user, catalog movement): the row already carrying the
  --    catalog name if there is one, else the oldest.
  CREATE TEMP TABLE merge_survivors ON COMMIT DROP AS
  SELECT DISTINCT ON (u.user_id, u.functional_movement_id)
    u.user_id,
    u.functional_movement_id,
    u.id AS survivor_id
  FROM public.user_movements u
  JOIN public.movements m ON m.id = u.functional_movement_id
  ORDER BY
    u.user_id,
    u.functional_movement_id,
    (u.canonical_name = m."Movement") DESC,
    u.created_at,
    u.id;

  CREATE TEMP TABLE merge_losers ON COMMIT DROP AS
  SELECT u.id AS loser_id, s.survivor_id
  FROM public.user_movements u
  JOIN merge_survivors s
    ON s.user_id = u.user_id
   AND s.functional_movement_id = u.functional_movement_id
  WHERE u.id <> s.survivor_id;

  UPDATE public.movement_logs ml
  SET user_movement_id = l.survivor_id
  FROM merge_losers l
  WHERE ml.user_movement_id = l.loser_id;
  GET DIAGNOSTICS v_logs_repointed = ROW_COUNT;

  DELETE FROM public.user_movements u
  USING merge_losers l
  WHERE u.id = l.loser_id;
  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

  -- 2. Linked rows take the catalog name.
  UPDATE public.user_movements u
  SET canonical_name = m."Movement"
  FROM public.movements m
  WHERE u.functional_movement_id = m.id
    AND u.canonical_name <> m."Movement";
  GET DIAGNOSTICS v_rows_renamed = ROW_COUNT;

  -- 3. A self-authored session still prescribing the old name would log under
  --    it and miss the renamed row. Rewrite only the owner's own programs.
  UPDATE public.program_sessions ps
  SET workout_options = jsonb_set(
    ps.workout_options,
    '{movements}',
    (
      SELECT jsonb_agg(
        CASE
          WHEN r.new_name IS NOT NULL
            THEN jsonb_set(elem, '{movementName}', to_jsonb(r.new_name))
          ELSE elem
        END
        ORDER BY ord
      )
      FROM jsonb_array_elements(ps.workout_options->'movements') WITH ORDINALITY AS m(elem, ord)
      LEFT JOIN renamed_rows r
        ON r.user_id = p.owner_id
       AND r.old_name = elem->>'movementName'
    )
  )
  FROM public.programs p
  WHERE p.id = ps.program_id
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(ps.workout_options->'movements') AS m(elem)
      JOIN renamed_rows r
        ON r.user_id = p.owner_id
       AND r.old_name = elem->>'movementName'
    );
  GET DIAGNOSTICS v_sessions_fixed = ROW_COUNT;

  RAISE NOTICE 'user_movements merge: logs repointed=%, duplicate rows deleted=%, rows renamed to catalog=%, program_sessions rewritten=%',
    v_logs_repointed, v_rows_deleted, v_rows_renamed, v_sessions_fixed;
END $$;

-- 4. The app now reuses by catalog id before name; this makes a regression loud.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_movements_user_catalog
  ON public.user_movements (user_id, functional_movement_id)
  WHERE functional_movement_id IS NOT NULL;
