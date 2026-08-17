-- Adds loaded marches, band pull-downs, and the Pallof press family.
-- The slim-catalog reload migration is already applied upstream and will not
-- re-run, so catalog additions land as a forward migration. Each insert is
-- guarded on the name because `movements."Movement"` has no unique index, which
-- keeps this safe on `supabase db reset` (where the reload runs first) and on
-- re-application.
INSERT INTO public.movements (
  "Movement",
  "Primary Equipment",
  "# Primary Items",
  "Single or Double Arm",
  "Target Muscle Group",
  "Difficulty Level",
  "Movement Pattern #1",
  pattern_credits
)
SELECT *
FROM (
  VALUES
    ('Kettlebell Suitcase March', 'Kettlebell', 1, 'Single Arm', 'Abdominals', 'Beginner', 'Loaded Carry', ARRAY['carry']::text[]),
    ('Double Kettlebell Farmer March', 'Kettlebell', 2, 'Double Arm', 'Forearms', 'Beginner', 'Loaded Carry', ARRAY['carry']::text[]),
    ('Band Pull-Down', 'Bodyweight', 1, 'Double Arm', 'Back', 'Beginner', 'Vertical Pull', ARRAY['pull']::text[]),
    ('Single-Arm Band Pull-Down', 'Bodyweight', 1, 'Single Arm', 'Back', 'Beginner', 'Vertical Pull', ARRAY['pull']::text[]),
    ('Pallof Press', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Beginner', 'Anti-Rotation', ARRAY['core']::text[]),
    ('Half-Kneeling Pallof Press', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Intermediate', 'Anti-Rotation', ARRAY['core']::text[]),
    ('Single-Leg Pallof Press', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Expert', 'Anti-Rotation', ARRAY['core']::text[])
) AS incoming (
  movement,
  primary_equipment,
  primary_item_count,
  single_or_double_arm,
  target_muscle_group,
  difficulty_level,
  movement_pattern_1,
  pattern_credits
)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.movements m
  WHERE lower(m."Movement") = lower(incoming.movement)
);
