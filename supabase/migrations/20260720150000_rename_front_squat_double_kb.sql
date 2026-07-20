-- PROD-239: Rename the catalog movement
--   'Front Squat With Two Kettlebells' -> 'Double Kettlebell Front Squat'
-- everywhere the old string is denormalized, so nothing splits or orphans.
--
-- The reload migration (20260709000000_slim_movements_catalog.sql) and the CSV
-- source of truth now emit the new name, so a fresh `db reset` reproduces the
-- catalog correctly. But that reload is already applied in production
-- (forward-only `db push` skips applied versions), and the old name is also
-- baked into seeded program JSON and denormalized user rows. This forward
-- data-fix reconciles the DEPLOYED data. Modeled on #142
-- (20260717000000_relink_deployed_dfw_to_catalog.sql).
--
-- All four parts are idempotent, guarded, and NULL-safe: a re-run (or a fresh
-- env where the reload/seeds already carry the new name) matches nothing.
-- Row counts are surfaced via RAISE NOTICE for the post-merge prod survival
-- check.

DO $$
DECLARE
  v_catalog_renamed  INT;
  v_sessions_fixed   INT;
  v_canonical_fixed  INT;
  v_orphans_relinked INT;
BEGIN
  -- 1. Rename the catalog row in place. The id is untouched, so every FK
  --    (user_movements.functional_movement_id) stays valid.
  UPDATE public.movements
  SET "Movement" = 'Double Kettlebell Front Squat'
  WHERE "Movement" = 'Front Squat With Two Kettlebells';
  GET DIAGNOSTICS v_catalog_renamed = ROW_COUNT;

  -- 2. Rewrite the stored movementName in EVERY program_sessions row that
  --    carries the old name. The seeded shared templates (Dry Fighting Weight,
  --    Armor Building Complex, Easy Strength) and their copy-on-enroll clones
  --    carry it, but so can a SELF-AUTHORED program: this is a real catalog
  --    movement any user could have placed in a program via the PROD-237
  --    builder. Left unfixed, that session's next logged workout spawns a fresh
  --    user_movements row (old canonical_name, NULL FK) — the exact PROD-234
  --    orphan class this rename exists to prevent. Scope solely by the
  --    containment guard: it already touches only sessions holding the old name,
  --    so broadening past the shared programs is strictly correct.
  UPDATE public.program_sessions ps
  SET workout_options = jsonb_set(
    ps.workout_options,
    '{movements}',
    (
      SELECT jsonb_agg(
        CASE elem->>'movementName'
          WHEN 'Front Squat With Two Kettlebells'
            THEN jsonb_set(elem, '{movementName}', '"Double Kettlebell Front Squat"'::jsonb)
          ELSE elem
        END
        ORDER BY ord
      )
      FROM jsonb_array_elements(ps.workout_options->'movements') WITH ORDINALITY AS m(elem, ord)
    )
  )
  WHERE ps.workout_options->'movements' @> '[{"movementName": "Front Squat With Two Kettlebells"}]'::jsonb;
  GET DIAGNOSTICS v_sessions_fixed = ROW_COUNT;

  -- 3. Rename the denormalized canonical_name on user_movements rows already
  --    linked to the (now renamed) catalog id. Without this, a future log under
  --    the new catalog name would create a SECOND user_movements row and split
  --    the lifter's history across two rows.
  UPDATE public.user_movements u
  SET canonical_name = 'Double Kettlebell Front Squat'
  FROM public.movements m
  WHERE m."Movement" = 'Double Kettlebell Front Squat'
    AND u.functional_movement_id = m.id
    AND u.canonical_name = 'Front Squat With Two Kettlebells';
  GET DIAGNOSTICS v_canonical_fixed = ROW_COUNT;

  -- 4. Re-relink the PROD-234 orphan target. The applied relink
  --    (20260716090000_relink_orphaned_user_movements.sql) mapped
  --    'Double Kettlebell Front Rack Squat' -> 'Front Squat With Two Kettlebells'.
  --    After the reload emits the new name, that JOIN matches nothing on a fresh
  --    reset, re-stranding those rows; in prod any still-NULL row (e.g. logged
  --    after the relink) is likewise unmatched. Relink them to the new name.
  --    Writes only where functional_movement_id IS NULL, so already-linked rows
  --    are untouched and a re-run is a no-op.
  UPDATE public.user_movements u
  SET functional_movement_id = m.id
  FROM public.movements m
  WHERE m."Movement" = 'Double Kettlebell Front Squat'
    AND lower(u.canonical_name) = lower('Double Kettlebell Front Rack Squat')
    AND u.functional_movement_id IS NULL;
  GET DIAGNOSTICS v_orphans_relinked = ROW_COUNT;

  RAISE NOTICE 'PROD-239 rename: catalog rows renamed=%, program_sessions rewritten=%, user_movements canonical renamed=%, orphans relinked=%',
    v_catalog_renamed, v_sessions_fixed, v_canonical_fixed, v_orphans_relinked;
END $$;
