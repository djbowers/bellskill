-- Secondary pattern credits for movements that demand a second fundamental
-- pattern at real intensity (the get-up precedent): offset-load carries pay
-- core, clean-and-press / thruster / burpee / muscle-up carry their setup
-- pattern, and plank-based rows and pull-ups credit core.
-- Source of truth is scripts/data/movements.csv; these rows were lifted from
-- `node scripts/ingest-movements.mjs --emit-credits-sql`.

UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge', 'core']::text[] WHERE "Movement" = 'Bird Dog';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Pull', pattern_credits = ARRAY['pull', 'core']::text[] WHERE "Movement" = 'Alternating Renegade Row';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Pull', pattern_credits = ARRAY['pull', 'core']::text[] WHERE "Movement" = 'Kettlebell Renegade Row';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push', 'core']::text[] WHERE "Movement" = 'Push-Up to Side Plank';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat', 'push']::text[] WHERE "Movement" = 'Burpee';
UPDATE public.movements SET "Movement Pattern #1" = 'Loaded Carry', pattern_credits = ARRAY['carry', 'core']::text[] WHERE "Movement" = 'Kettlebell Suitcase Carry';
UPDATE public.movements SET "Movement Pattern #1" = 'Loaded Carry', pattern_credits = ARRAY['carry', 'core']::text[] WHERE "Movement" = 'Kettlebell Suitcase March';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull', 'core']::text[] WHERE "Movement" = 'Gorilla Chin-Up Crunch';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull', 'core']::text[] WHERE "Movement" = 'L-Sit Pull-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull', 'push']::text[] WHERE "Movement" = 'Muscle-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['hinge', 'push']::text[] WHERE "Movement" = 'Double Kettlebell Clean and Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['hinge', 'push']::text[] WHERE "Movement" = 'Kettlebell Clean and Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['hinge', 'push']::text[] WHERE "Movement" = 'One-Arm Kettlebell Clean and Jerk';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push', 'rotation']::text[] WHERE "Movement" = 'Kettlebell Bent Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['squat', 'push']::text[] WHERE "Movement" = 'Double Kettlebell Thruster';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['squat', 'push']::text[] WHERE "Movement" = 'Kettlebell Thruster';
