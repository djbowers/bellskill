-- PROD-234: relink user_movements orphaned by the PROD-153 catalog slim.
--
-- WHAT HAPPENED
-- 20260709000000_slim_movements_catalog.sql nulled every
-- user_movements.functional_movement_id (step 2), reloaded the catalog under
-- new names, then best-effort relinked on an exact, case-insensitive
-- canonical_name = "Movement" match (step 9). That same migration RENAMED much
-- of the catalog -- "Single Arm X" -> "One-Arm X", "Get Up" -> "Get-Up",
-- "Push Up" -> "Push-Up" -- so every renamed row matched nothing and stayed
-- null. Prod on 2026-07-15: 29 of 34 user_movements orphaned across 3 users,
-- 66 workout logs affected. pattern_debt_window LEFT JOINs through
-- functional_movement_id, so an orphaned movement is silently excluded from
-- bucketing: those 66 logs contribute no pattern debt and the user's balance
-- reads as a gap that isn't real.
--
-- WHY THIS IS ADDITIVE
-- 20260709000000 is already applied in prod. Editing it would be a no-op there
-- and would desync `supabase db reset` from production reality. Forward fix
-- only.
--
-- SAFETY / IDEMPOTENCY
-- Matches on name and writes ONLY where functional_movement_id IS NULL, so an
-- already-linked row is never touched and a second run updates 0 rows.
--
-- THE MAPPING (27 distinct orphaned canonical_names; log counts from prod
-- 2026-07-15). 24 map; 3 are deliberately left null because the catalog is
-- Kettlebell + Bodyweight only and has no equivalent -- null here means
-- "genuinely not in this catalog", not "unmatched".
--
-- Lines marked `REVIEW:` are kettlebell-domain judgment calls that need a
-- practitioner's eye. Everything else is a mechanical rename.

WITH mapping (old_name, new_name) AS (
  VALUES
    -- 9 logs. Mechanical "Single Arm" -> "One-Arm" rename.
    ('Single Arm Kettlebell Swing'::text, 'One-Arm Kettlebell Swing'::text),

    -- 6 logs. The double-bell front squat. Catalog metadata disambiguates:
    -- "Front Squat With Two Kettlebells" is 2 items / Double Arm, whereas
    -- "Kettlebell Front Rack Squat" is 1 item / Single Arm -- so the
    -- similarly-named row is NOT the right target for a double.
    ('Double Kettlebell Front Rack Squat', 'Front Squat With Two Kettlebells'),

    -- 6 logs. "Get Up" -> "Get-Up"; the TGU is inherently one-arm, so the new
    -- catalog drops the "Single Arm" qualifier (row is 1 item / Single Arm).
    -- REVIEW: "(Lunge Style)" and "(Squat Style)" variants also exist. The
    -- unqualified row is the right default for a user who never picked a
    -- style, but confirm.
    ('Single Arm Kettlebell Turkish Get Up', 'Kettlebell Turkish Get-Up'),

    -- 4 logs. "Bodyweight X" prefix dropped + hyphenation.
    ('Bodyweight Push Up', 'Push-Up'),

    -- 4 logs. REVIEW: drops "Contralateral". The catalog has no contralateral
    -- (bell in the hand opposite the working leg) variant -- it is a loading
    -- choice, not a separate movement here. "Kettlebell Single-Leg Romanian
    -- Deadlift" (1 item / Single Arm / Hip Hinge) keeps both the hinge pattern
    -- and the single-leg stance. Rejected "Kettlebell Single-Leg Deadlift":
    -- correct on stance and arguably the closer name, but an SLDL and a
    -- single-leg RDL are distinct movements and the logged name says Romanian.
    ('Single Arm Kettlebell Contralateral Single Leg Romanian Deadlift', 'Kettlebell Single-Leg Romanian Deadlift'),

    -- 4 logs. REVIEW: the new catalog names the strict one-arm overhead press
    -- "Military Press" (1 item / Single Arm / Vertical Push). Rejected
    -- "One-Arm Kettlebell Push Press" (leg drive -- a different movement) and
    -- "One-Arm Kettlebell Para Press" / "Kettlebell Bottoms-Up Press"
    -- (specific variants the user did not name).
    ('Single Arm Kettlebell Overhead Press', 'One-Arm Kettlebell Military Press'),

    -- 4 logs. DELIBERATELY NULL: no "march" anywhere in the catalog. A loaded
    -- march is a stationary knee-drive carry, not a walking carry. Rejected
    -- "Kettlebell Suitcase Carry" -- same loading, but mapping a march onto a
    -- carry would fabricate a movement the user never did.
    ('Single Arm Kettlebell Suitcase March', NULL),

    -- 4 logs. The windmill is inherently one-arm (bell locked out overhead in
    -- one hand); the unqualified row is 1 item / Single Arm.
    -- REVIEW: "Advanced Kettlebell Windmill" and "Kettlebell Overhead Windmill"
    -- also exist; the plain row is the right default for an unqualified log.
    ('Single Arm Kettlebell Windmill', 'Kettlebell Windmill'),

    -- 3 logs. "Clean to Overhead Press" is the clean and press.
    ('Double Kettlebell Clean to Overhead Press', 'Double Kettlebell Clean and Press'),

    -- 3 logs. Mechanical "Single Arm" -> "One-Arm" rename.
    ('Single Arm Kettlebell Snatch', 'One-Arm Kettlebell Snatch'),

    -- 2 logs. The catalog names the two-bell clean "Two-Arm Kettlebell Clean"
    -- (2 items / Double Arm). Rejected "Double Kettlebell Dead Clean": also 2
    -- items, but the dead clean resets to the floor each rep -- a variant the
    -- user did not name.
    ('Double Kettlebell Clean', 'Two-Arm Kettlebell Clean'),

    -- 2 logs. REVIEW: drops the clean. The catalog has no "clean to push
    -- press" compound; the push press starts from the front rack, which the
    -- clean is how you reach. Rejected leaving it null: the vertical-push
    -- pattern is genuinely in the catalog, so null would misreport debt.
    ('Double Kettlebell Clean to Push Press', 'Double Kettlebell Push Press'),

    -- 2 logs. Same reasoning as the clean-to-push-press above: a thruster
    -- inherently begins in the front rack.
    ('Double Kettlebell Clean to Thruster', 'Double Kettlebell Thruster'),

    -- 2 logs. Same movement, "Double" moved position (2 items / Double Arm).
    ('Double Kettlebell Overhead Carry', 'Kettlebell Double Overhead Carry'),

    -- 2 logs. REVIEW: same "overhead press" -> "Military Press" rename as the
    -- one-arm case above; this row is 2 items / Double Arm.
    ('Double Kettlebell Overhead Press', 'Two-Arm Kettlebell Military Press'),

    -- 2 logs. REVIEW: a two-bell suitcase carry IS a farmer's carry
    -- (2 items / Double Arm / Loaded Carry). Rejected "Kettlebell Suitcase
    -- Carry": the obvious name match, but it is 1 item / Single Arm, so it
    -- would file a double as a single and understate the load.
    ('Double Kettlebell Suitcase Carry', 'Kettlebell Farmer''s Carry'),

    -- 2 logs. REVIEW -- weakest mapping in this migration. The catalog has NO
    -- plain (both-feet-down) split squat; every split squat in it is Bulgarian
    -- (rear foot elevated), which is a harder movement than what was logged.
    -- "Kettlebell Front Rack Bulgarian Split Squat" (1 item / Single Arm /
    -- Knee Dominant) matches on rack position, arm count, and pattern, and is
    -- wrong only on rear-foot elevation. Rejected leaving it null: the
    -- knee-dominant pattern is well represented, so null would understate
    -- pattern coverage for a movement the user actually trained. Also drops
    -- "Contralateral" (no such variant in catalog). Say the word and I will
    -- flip this to null instead.
    ('Single Arm Kettlebell Front Rack Contralateral Split Squat', 'Kettlebell Front Rack Bulgarian Split Squat'),

    -- 1 log. DELIBERATELY NULL: the catalog is Kettlebell + Bodyweight only
    -- and contains no band equipment at all (zero rows match "band"). There is
    -- no honest target.
    ('Single Arm Band Pull Down', NULL),

    -- 1 log. The bent-over row is the standard one-arm kettlebell row
    -- (1 item / Single Arm / Horizontal Pull).
    ('Single Arm Kettlebell Bent Over Row', 'One-Arm Kettlebell Row'),

    -- 1 log. Mechanical "Single Arm" -> "One-Arm" rename; exact target exists.
    ('Single Arm Kettlebell Floor Press', 'One-Arm Kettlebell Floor Press'),

    -- 1 log. Drops "Contralateral" only (no such variant in catalog);
    -- otherwise an exact match on rack position, arm count, and Bulgarian.
    ('Single Arm Kettlebell Front Rack Contralateral Bulgarian Split Squat', 'Kettlebell Front Rack Bulgarian Split Squat'),

    -- 1 log. DELIBERATELY NULL: the Pallof press is an anti-rotation
    -- cable/band movement. Zero rows match "pallof" and the catalog has no
    -- cable or band equipment. No honest target.
    ('Single Leg Pallof Press', NULL),

    -- 0 logs. REVIEW: drops both "Alternating" and the clean. The catalog has
    -- no alternating single-bell thruster. "Kettlebell Thruster" is the only
    -- single-bell thruster (1 item), though it is tagged Double Arm (two hands
    -- on one bell), so the arm count is imperfect. Rejected "Double Kettlebell
    -- Thruster": correct on alternating-implies-one-arm-at-a-time, but it is a
    -- 2-bell movement and this was logged with one.
    ('Alternating Single Arm Kettlebell Clean to Thruster', 'Kettlebell Thruster'),

    -- 0 logs. "Alternating" already implies one arm at a time, so the new
    -- catalog drops the redundant qualifier (1 item / Single Arm).
    ('Alternating Single Arm Kettlebell Swing', 'Alternating Kettlebell Swing'),

    -- 0 logs. Redundant "Kettlebell" prefix dropped; the catalog's "Goblet
    -- Squat" is already Kettlebell equipment / 1 item.
    ('Kettlebell Goblet Squat', 'Goblet Squat'),

    -- 0 logs. REVIEW: "prone row" is not a name the new catalog uses.
    -- "One-Arm Kettlebell Row" (1 item / Single Arm / Horizontal Pull) matches
    -- arm count and pattern. Rejected "Kettlebell Renegade Row": arguably
    -- closer on body position (prone plank), but it is 2 items / Double Arm /
    -- Expert, so it would file a single-arm row as a two-bell expert movement.
    ('Single Arm Kettlebell Prone Row', 'One-Arm Kettlebell Row'),

    -- 0 logs. The suitcase carry is inherently one-bell/one-arm, so the new
    -- catalog drops the qualifier (1 item / Single Arm).
    ('Single Arm Kettlebell Suitcase Carry', 'Kettlebell Suitcase Carry')
)
UPDATE public.user_movements u
SET functional_movement_id = m.id
FROM mapping map
JOIN public.movements m ON lower(m."Movement") = lower(map.new_name)
WHERE u.functional_movement_id IS NULL
  AND lower(u.canonical_name) = lower(map.old_name);

-- Post-check. Reports any still-orphaned canonical_name that this migration did
-- NOT deliberately leave null -- i.e. a mapping target that resolved to nothing
-- (a typo), or an orphan that appeared after the 2026-07-15 audit.
--
-- Deliberately a WARNING, not an EXCEPTION: a failed migration aborts the whole
-- `supabase db push` (this is what caused the 2026-07-14 outage), and an
-- unexpected leftover orphan is harmless -- it degrades exactly as it does
-- today. Loud in the push log, never blocking.
DO $$
DECLARE
  v_unexpected text;
BEGIN
  SELECT string_agg(DISTINCT u.canonical_name, ', ' ORDER BY u.canonical_name)
  INTO v_unexpected
  FROM public.user_movements u
  WHERE u.functional_movement_id IS NULL
    AND lower(u.canonical_name) NOT IN (
      lower('Single Arm Band Pull Down'),
      lower('Single Leg Pallof Press'),
      lower('Single Arm Kettlebell Suitcase March')
    );

  IF v_unexpected IS NOT NULL THEN
    RAISE WARNING 'PROD-234: user_movements still orphaned after relink (not in the deliberate-null set): %', v_unexpected;
  END IF;
END $$;
