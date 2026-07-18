-- Reconcile the DEPLOYED Dry Fighting Weight program data to the movements
-- catalog. Follow-up to the DFW seed name fix, modeled on the PROD-234 relink
-- (20260716090000_relink_orphaned_user_movements.sql).
--
-- The DFW seed (20260706170001_seed_dry_fighting_weight.sql) wrote two movement
-- names that do not exist in the 252-row catalog: 'Clean and Press' and
-- 'Front Squat'. That seed migration is already applied in production, so
-- correcting the seed file itself is inert there (forward-only `db push` skips
-- applied versions). This migration fixes the data the applied seed left behind.
--
-- Correct catalog targets are the DOUBLE-bell variants, consistent with DFW's
-- two-bell weight structure (every seeded movement sets both weightOne AND
-- weightTwo). Both targets are Double Arm / 2 primary items in the catalog:
--   'Clean and Press' -> 'Double Kettlebell Clean and Press'
--   'Front Squat'     -> 'Front Squat With Two Kettlebells'
--
-- Two idempotent, DFW-scoped parts:
--   1. Rewrite the stored movementName in program_sessions.workout_options for
--      the DFW system template AND its copy-on-enroll clones (source_program_id
--      -> DFW). enroll_in_program copies workout_options verbatim, so each of
--      the 7 existing enrollees holds an active clone carrying the old names;
--      left unfixed, their future logged sessions would keep orphaning.
--   2. Relink user_movements that enrollees already logged under the old names
--      (NULL functional_movement_id) to the catalog rows, exactly as PROD-234
--      does -- writing only where the FK IS NULL, so already-linked rows are
--      untouched and a re-run is a no-op. Both old names are absent from the
--      catalog, so any such row is already unbucketed; both catalog targets
--      share the same movement pattern as any single-bell variant
--      (Vertical Push / Knee Dominant), so the pattern_debt_window bucket is
--      correct regardless of bell count.

-- Part 1 — correct the already-seeded (and cloned) DFW template rows.
UPDATE public.program_sessions ps
SET workout_options = jsonb_set(
  ps.workout_options,
  '{movements}',
  (
    SELECT jsonb_agg(
      CASE elem->>'movementName'
        WHEN 'Clean and Press'
          THEN jsonb_set(elem, '{movementName}', '"Double Kettlebell Clean and Press"'::jsonb)
        WHEN 'Front Squat'
          THEN jsonb_set(elem, '{movementName}', '"Front Squat With Two Kettlebells"'::jsonb)
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
    p.slug = 'dry-fighting-weight'
    OR p.source_program_id = (SELECT id FROM public.programs WHERE slug = 'dry-fighting-weight')
  )
  AND (
    ps.workout_options->'movements' @> '[{"movementName": "Clean and Press"}]'::jsonb
    OR ps.workout_options->'movements' @> '[{"movementName": "Front Squat"}]'::jsonb
  );

-- Part 2 — relink enrollee logs orphaned under the old names (PROD-234 pattern).
UPDATE public.user_movements u
SET functional_movement_id = m.id
FROM (VALUES
  ('Clean and Press', 'Double Kettlebell Clean and Press'),
  ('Front Squat',     'Front Squat With Two Kettlebells')
) AS map(orphan_name, catalog_name)
JOIN public.movements m ON lower(m."Movement") = lower(map.catalog_name)
WHERE lower(u.canonical_name) = lower(map.orphan_name)
  AND u.functional_movement_id IS NULL;
