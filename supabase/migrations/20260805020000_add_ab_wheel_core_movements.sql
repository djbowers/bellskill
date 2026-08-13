-- Adds the ab wheel family plus four adjacent core gaps to the catalog.
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
    ('Ab Wheel Rollout', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Intermediate', 'Anti-Extension', ARRAY['core']::text[]),
    ('Standing Ab Wheel Rollout', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Expert', 'Anti-Extension', ARRAY['core']::text[]),
    ('Ab Wheel Oblique Rollout', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Intermediate', 'Anti-Rotation', ARRAY['core']::text[]),
    ('Reverse Plank', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Beginner', 'Anti-Extension', ARRAY['core']::text[]),
    ('Side Plank Hip Dip', 'Bodyweight', 1, 'Single Arm', 'Abdominals', 'Intermediate', 'Anti-Rotation', ARRAY['core']::text[]),
    ('Hanging Windshield Wipers', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Expert', 'Rotational', ARRAY['rotation']::text[]),
    ('Kettlebell Plank Drag', 'Kettlebell', 1, 'Single Arm', 'Abdominals', 'Intermediate', 'Anti-Rotation', ARRAY['core']::text[])
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
