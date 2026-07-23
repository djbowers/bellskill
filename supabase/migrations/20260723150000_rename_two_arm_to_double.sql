-- Rename the five "Two-Arm Kettlebell …" catalog movements to "Double …".
--
-- Every one of these rows is already coded as a double-kettlebell movement
-- (# Primary Items = 2, Single or Double Arm = Double Arm), so "Two-Arm" only
-- misled ("two arms on one bell"). Four are renamed in place; the fifth,
-- 'Two-Arm Kettlebell Jerk', is a byte-identical duplicate of the existing
-- 'Double Kettlebell Jerk' and is CONSOLIDATED into it rather than renamed.
--
-- The CSV source of truth and the reload migration
-- (20260709000000_slim_movements_catalog.sql) now emit the new names, so a fresh
-- `db reset` reproduces the catalog correctly. But that reload is already applied
-- in production (forward-only `db push` skips applied versions), and the old
-- names are also baked into seeded program JSON and denormalized user rows. This
-- forward data-fix reconciles the DEPLOYED data. Modeled on the PROD-239 rename
-- (20260720150000_rename_front_squat_double_kb.sql).
--
-- Every part is idempotent, guarded, and NULL-safe: on a re-run — or a fresh env
-- where the reload already carries the new names and the duplicate Jerk was never
-- inserted — each statement matches nothing. Row counts surface via RAISE NOTICE
-- for the post-merge prod survival check.

DO $$
DECLARE
  v_catalog_renamed  INT;
  v_sessions_fixed   INT;
  v_canonical_fixed  INT;
  v_jerk_relinked    INT;
  v_jerk_deleted     INT;
  v_orphans_relinked INT;
BEGIN
  -- 1. Rename the four catalog rows in place. The id is untouched, so every FK
  --    (user_movements.functional_movement_id) stays valid.
  UPDATE public.movements
  SET "Movement" = CASE "Movement"
    WHEN 'Two-Arm Kettlebell Clean'          THEN 'Double Kettlebell Clean'
    WHEN 'Two-Arm Kettlebell Military Press' THEN 'Double Kettlebell Military Press'
    WHEN 'Two-Arm Kettlebell Floor Press'    THEN 'Double Kettlebell Floor Press'
    WHEN 'Two-Arm Kettlebell Row'            THEN 'Double Kettlebell Row'
  END
  WHERE "Movement" IN (
    'Two-Arm Kettlebell Clean',
    'Two-Arm Kettlebell Military Press',
    'Two-Arm Kettlebell Floor Press',
    'Two-Arm Kettlebell Row'
  );
  GET DIAGNOSTICS v_catalog_renamed = ROW_COUNT;

  -- 2. Rewrite the stored movementName in EVERY program_sessions row carrying an
  --    old name. The seeded shared templates (Armor Building Complex, Easy
  --    Strength) and their copy-on-enroll clones carry the Clean/Military Press,
  --    but a SELF-AUTHORED program (PROD-237 builder) could hold any of the five.
  --    Left unfixed, that session's next logged workout spawns a fresh
  --    user_movements row (old canonical_name, NULL FK) — the exact PROD-234
  --    orphan class this rename exists to prevent. The Jerk maps to the surviving
  --    Double Kettlebell Jerk (consolidation). Scoped solely by the containment
  --    guard, so it touches only sessions actually holding an old name.
  UPDATE public.program_sessions ps
  SET workout_options = jsonb_set(
    ps.workout_options,
    '{movements}',
    (
      SELECT jsonb_agg(
        CASE elem->>'movementName'
          WHEN 'Two-Arm Kettlebell Clean'          THEN jsonb_set(elem, '{movementName}', '"Double Kettlebell Clean"'::jsonb)
          WHEN 'Two-Arm Kettlebell Military Press' THEN jsonb_set(elem, '{movementName}', '"Double Kettlebell Military Press"'::jsonb)
          WHEN 'Two-Arm Kettlebell Floor Press'    THEN jsonb_set(elem, '{movementName}', '"Double Kettlebell Floor Press"'::jsonb)
          WHEN 'Two-Arm Kettlebell Row'            THEN jsonb_set(elem, '{movementName}', '"Double Kettlebell Row"'::jsonb)
          WHEN 'Two-Arm Kettlebell Jerk'           THEN jsonb_set(elem, '{movementName}', '"Double Kettlebell Jerk"'::jsonb)
          ELSE elem
        END
        ORDER BY ord
      )
      FROM jsonb_array_elements(ps.workout_options->'movements') WITH ORDINALITY AS m(elem, ord)
    )
  )
  WHERE ps.workout_options->'movements' @> '[{"movementName": "Two-Arm Kettlebell Clean"}]'::jsonb
     OR ps.workout_options->'movements' @> '[{"movementName": "Two-Arm Kettlebell Military Press"}]'::jsonb
     OR ps.workout_options->'movements' @> '[{"movementName": "Two-Arm Kettlebell Floor Press"}]'::jsonb
     OR ps.workout_options->'movements' @> '[{"movementName": "Two-Arm Kettlebell Row"}]'::jsonb
     OR ps.workout_options->'movements' @> '[{"movementName": "Two-Arm Kettlebell Jerk"}]'::jsonb;
  GET DIAGNOSTICS v_sessions_fixed = ROW_COUNT;

  -- 3. Rename the denormalized canonical_name on user_movements rows already
  --    linked to one of the four (now renamed) catalog ids. Without this, a
  --    future log under the new name would create a SECOND user_movements row and
  --    split the lifter's history. Setting canonical_name = m."Movement" reads the
  --    already-renamed name straight off the joined catalog row.
  UPDATE public.user_movements u
  SET canonical_name = m."Movement"
  FROM public.movements m
  WHERE u.functional_movement_id = m.id
    AND u.canonical_name IN (
      'Two-Arm Kettlebell Clean',
      'Two-Arm Kettlebell Military Press',
      'Two-Arm Kettlebell Floor Press',
      'Two-Arm Kettlebell Row'
    )
    AND m."Movement" IN (
      'Double Kettlebell Clean',
      'Double Kettlebell Military Press',
      'Double Kettlebell Floor Press',
      'Double Kettlebell Row'
    );
  GET DIAGNOSTICS v_canonical_fixed = ROW_COUNT;

  -- 4. Jerk consolidation. Re-point every user_movements row referencing the
  --    duplicate Two-Arm Jerk — whether by FK id or by denormalized
  --    canonical_name (covers linked and orphaned rows) — onto the surviving
  --    Double Kettlebell Jerk, then delete the now-unreferenced duplicate.
  --    user_movements is the only FK to movements, so after the re-point the
  --    delete is safe.
  UPDATE public.user_movements u
  SET functional_movement_id = keep.id,
      canonical_name = 'Double Kettlebell Jerk'
  FROM public.movements keep
  WHERE keep."Movement" = 'Double Kettlebell Jerk'
    AND (
      u.canonical_name = 'Two-Arm Kettlebell Jerk'
      OR u.functional_movement_id IN (
        SELECT id FROM public.movements WHERE "Movement" = 'Two-Arm Kettlebell Jerk'
      )
    );
  GET DIAGNOSTICS v_jerk_relinked = ROW_COUNT;

  DELETE FROM public.movements
  WHERE "Movement" = 'Two-Arm Kettlebell Jerk';
  GET DIAGNOSTICS v_jerk_deleted = ROW_COUNT;

  -- 5. Relink the PROD-234 orphans these renames now make matchable. That relink
  --    (20260716090000_relink_orphaned_user_movements.sql) deliberately left them
  --    NULL because the double-bell targets did not exist yet. Write only where
  --    the FK IS NULL and join the live catalog for the id, so already-linked
  --    rows are untouched and a re-run is a no-op. canonical_name is left as the
  --    lifter authored it (the FK drives pattern-debt bucketing), matching how
  --    PROD-234's Tier C mappings linked to differently-named catalog rows.
  UPDATE public.user_movements u
  SET functional_movement_id = m.id
  FROM (VALUES
    -- PROD-235: exact — the double-bell clean now exists in the catalog.
    ('Double Kettlebell Clean',          'Double Kettlebell Clean'),
    -- PROD-242: a strict double-bell overhead press is a military press
    --           (PROD-234 already equated overhead press with military press).
    ('Double Kettlebell Overhead Press', 'Double Kettlebell Military Press')
  ) AS map(orphan_name, catalog_name)
  JOIN public.movements m ON lower(m."Movement") = lower(map.catalog_name)
  WHERE lower(u.canonical_name) = lower(map.orphan_name)
    AND u.functional_movement_id IS NULL;
  GET DIAGNOSTICS v_orphans_relinked = ROW_COUNT;

  RAISE NOTICE 'Two-Arm->Double rename: catalog renamed=%, program_sessions rewritten=%, canonical renamed=%, jerk relinked=%, jerk row deleted=%, orphans relinked=%',
    v_catalog_renamed, v_sessions_fixed, v_canonical_fixed, v_jerk_relinked, v_jerk_deleted, v_orphans_relinked;
END $$;
