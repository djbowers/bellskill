-- PROD-234: Relink user_movements orphaned by the PROD-153 catalog rename.
--
-- PROD-153 (20260709000000_slim_movements_catalog.sql) reloaded the catalog and
-- relinked user_movements on exact name match (lower(canonical_name) =
-- lower("Movement")) while *simultaneously renaming* movements. Rows whose old
-- canonical_name was renamed matched nothing and were left with a NULL FK. In
-- prod that stranded 29 of 34 user_movements rows (27 distinct names, 3 users),
-- silently zeroing those logs out of every pattern_debt_window bucket
-- (20260624000000_create_pattern_debt_function.sql joins on
-- functional_movement_id) and feeding the recommender under-counted patterns.
--
-- This migration reconciles the stranded USER data to the (correct) 252-row
-- catalog. It does NOT rename catalog rows and does NOT add any movement.
--
-- Idempotent + safe to re-run: matches case-insensitively on canonical_name,
-- writes only where functional_movement_id IS NULL, and joins to the live
-- catalog for the id, so already-linked rows are never touched and a re-run is a
-- no-op. Names with no catalog equivalent are deliberately left NULL (see the
-- DELIBERATE NULLS block below) — NULL here means "genuinely not in this
-- kettlebell + bodyweight catalog," not "renamed and lost."
--
-- Every mapping decision is stated inline. Tiers: A = clean Single Arm -> One-Arm
-- rename (exact hit); C = semantic reconciliation adjudicated by the captain on
-- PROD-234. Target names were each verified present in prod movements."Movement".

UPDATE public.user_movements u
SET functional_movement_id = m.id
FROM (VALUES
  -- Tier A — clean `Single Arm` -> `One-Arm` renames, exact catalog match:
  ('Single Arm Kettlebell Swing',                                        'One-Arm Kettlebell Swing'),
  ('Single Arm Kettlebell Snatch',                                       'One-Arm Kettlebell Snatch'),
  ('Single Arm Kettlebell Floor Press',                                  'One-Arm Kettlebell Floor Press'),

  -- Tier C — semantic reconciliation (captain-approved, PROD-234):
  -- 2-bell front-rack squat; the single-bell `Kettlebell Front Rack Squat` is a different movement.
  ('Double Kettlebell Front Rack Squat',                                 'Front Squat With Two Kettlebells'),
  -- The Turkish Get-Up is inherently single-arm; base variant (not Lunge-/Squat-style).
  ('Single Arm Kettlebell Turkish Get Up',                               'Kettlebell Turkish Get-Up'),
  -- Compound hyphenation + drop redundant `Bodyweight`; the base push-up.
  ('Bodyweight Push Up',                                                 'Push-Up'),
  -- Catalog carries no contralateral/arm qualifier; the single-leg KB RDL is the movement.
  ('Single Arm Kettlebell Contralateral Single Leg Romanian Deadlift',   'Kettlebell Single-Leg Romanian Deadlift'),
  -- Strict overhead press = military press; only one-arm overhead-press candidate.
  ('Single Arm Kettlebell Overhead Press',                              'One-Arm Kettlebell Military Press'),
  -- The windmill is inherently single-arm; base variant (not Advanced/Overhead).
  ('Single Arm Kettlebell Windmill',                                     'Kettlebell Windmill'),
  -- Clean-to-overhead-press is the clean and press.
  ('Double Kettlebell Clean to Overhead Press',                          'Double Kettlebell Clean and Press'),
  -- The scored movement is a push press (the clean is the entry).
  ('Double Kettlebell Clean to Push Press',                              'Double Kettlebell Push Press'),
  -- The scored movement is a thruster (the clean is the entry).
  ('Double Kettlebell Clean to Thruster',                                'Double Kettlebell Thruster'),
  -- Pure word reorder.
  ('Double Kettlebell Overhead Carry',                                   'Kettlebell Double Overhead Carry'),
  -- 2-bell strict overhead press = two-arm military press.
  ('Double Kettlebell Overhead Press',                                   'Two-Arm Kettlebell Military Press'),
  -- 2-bell suitcase carry = farmer's carry (captain lean on low-confidence row).
  ('Double Kettlebell Suitcase Carry',                                   'Kettlebell Farmer''s Carry'),
  -- No plain front-rack split squat in catalog; nearest match is the Bulgarian (captain lean).
  ('Single Arm Kettlebell Front Rack Contralateral Split Squat',         'Kettlebell Front Rack Bulgarian Split Squat'),
  -- The KB row is the bent-over row.
  ('Single Arm Kettlebell Bent Over Row',                                'One-Arm Kettlebell Row'),
  -- Drop arm/contralateral qualifiers; exact movement.
  ('Single Arm Kettlebell Front Rack Contralateral Bulgarian Split Squat','Kettlebell Front Rack Bulgarian Split Squat'),
  -- An alternating swing is a single-arm alternating swing.
  ('Alternating Single Arm Kettlebell Swing',                            'Alternating Kettlebell Swing'),
  -- Only one goblet squat; the `Kettlebell` prefix is redundant.
  ('Kettlebell Goblet Squat',                                            'Goblet Squat'),
  -- The suitcase carry is single-arm by definition.
  ('Single Arm Kettlebell Suitcase Carry',                               'Kettlebell Suitcase Carry')
) AS map(orphan_name, catalog_name)
JOIN public.movements m ON lower(m."Movement") = lower(map.catalog_name)
WHERE lower(u.canonical_name) = lower(map.orphan_name)
  AND u.functional_movement_id IS NULL;

-- DELIBERATE NULLS — left unlinked on purpose; each keeps its canonical_name.
-- These have no correct equivalent in the kettlebell + bodyweight catalog, so a
-- NULL FK is the accurate state (the log is legitimately excluded from bucketing
-- rather than mis-bucketed):
--   * Single Arm Band Pull Down                  — catalog has no band movements.
--   * Single Leg Pallof Press                    — catalog has no pallof movements.
--   * Single Arm Kettlebell Suitcase March       — catalog has no march movements.
--   * Alternating Single Arm Kettlebell Clean to Thruster
--                                                — no alternating thruster exists in the catalog.
--   * Single Arm Kettlebell Prone Row            — a prone/chest-supported row is a distinct
--                                                  movement from the standard KB row.
--   * Double Kettlebell Clean                    — a legitimate movement genuinely MISSING from
--                                                  the catalog (Two-Arm Clean = one bell/two hands,
--                                                  Dead Clean = a distinct floor variant; neither is
--                                                  correct). Catalog gap tracked in PROD-235; the
--                                                  movement is intentionally NOT added here.
--
-- Expected post-migration prod count of user_movements WHERE functional_movement_id IS NULL: 6.
