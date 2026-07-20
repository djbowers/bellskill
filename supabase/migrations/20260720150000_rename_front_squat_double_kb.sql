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

  -- 2. Rewrite the stored movementName in program_sessions.workout_options for
  --    the shared-program TEMPLATES that reference it (Dry Fighting Weight,
  --    Armor Building Complex, Easy Strength) AND their copy-on-enroll CLONES
  --    (source_program_id -> a template). enroll_in_program copies
  --    workout_options verbatim, so every enrollee holds a clone carrying the
  --    old name; left unfixed their future logged sessions would orphan.
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
  FROM public.programs p
  WHERE p.id = ps.program_id
    AND (
      p.slug IN ('dry-fighting-weight', 'armor-building-complex', 'easy-strength')
      OR p.source_program_id IN (
        SELECT id FROM public.programs
        WHERE slug IN ('dry-fighting-weight', 'armor-building-complex', 'easy-strength')
      )
    )
    AND ps.workout_options->'movements' @> '[{"movementName": "Front Squat With Two Kettlebells"}]'::jsonb;
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
