-- Pattern-debt ledger Phase 1 (PROD-155 expansion): taxonomy split + boolean
-- multi-pattern credit.
--
-- * Movement Pattern #1 vocabulary gains Anti-Rotation / Anti-Extension
--   (catalog sub-labels rolling up into the new scored `core` pattern).
-- * movements.pattern_credits text[] names every coarse pattern a movement
--   pays credit toward (TGU -> get_up|push|rotation). Source of truth is
--   scripts/data/movements.csv; this block is generated with
--   `node scripts/ingest-movements.mjs --emit-credits-sql`.
-- * Ordered per plan: extend constraint -> re-tag/populate -> validate.

-- 1. Extend the pattern vocabulary.
ALTER TABLE public.movements
  DROP CONSTRAINT IF EXISTS movements_movement_pattern_check;
ALTER TABLE public.movements
  ADD CONSTRAINT movements_movement_pattern_check
    CHECK ("Movement Pattern #1" IN (
      'Hip Hinge', 'Hip Dominant', 'Hip Extension', 'Knee Dominant',
      'Vertical Push', 'Horizontal Push', 'Vertical Pull', 'Horizontal Pull',
      'Loaded Carry', 'Rotational', 'Spinal Rotational',
      'Anti-Rotation', 'Anti-Extension'
    ));

-- 2. Add the credits column (nullable while we backfill).
ALTER TABLE public.movements ADD COLUMN IF NOT EXISTS pattern_credits text[];

-- 3. Re-tag + populate every row from the CSV (generated block).
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Swing';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'One-Arm Kettlebell Swing';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Double Kettlebell Swing';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Alternating Kettlebell Swing';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Dead Clean';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Hang Clean';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'One-Arm Kettlebell Clean';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Bottoms-Up Kettlebell Clean';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Bottoms-Up Kettlebell Clean From Hang';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Double Kettlebell Clean';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Double Kettlebell Dead Clean';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Double Kettlebell Alternating Hang Clean';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Alternating Kettlebell Hang Clean';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'One-Arm Kettlebell Snatch';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'One-Arm Kettlebell Split Snatch';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Dead Snatch';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Hang Snatch';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Double Kettlebell Snatch';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Sumo High Pull';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'One-Arm Kettlebell High Pull';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Double Kettlebell High Pull';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Snatch Pull';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Figure 8';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Pass Between The Legs';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Pirate Ships';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Hike Pass';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Deadlift';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Sumo Deadlift';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Suitcase Deadlift';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Romanian Deadlift';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Double Kettlebell Romanian Deadlift';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Single-Leg Deadlift';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Single-Leg Romanian Deadlift';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Staggered Deadlift';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Kettlebell Good Morning';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Goblet Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Double Kettlebell Front Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Pistol Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'One-Arm Overhead Kettlebell Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Front Rack Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Cossack Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Goblet Reverse Lunge';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Racked Reverse Lunge';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Goblet Forward Lunge';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Racked Forward Lunge';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Goblet Walking Lunge';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Overhead Reverse Lunge';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Double Kettlebell Front Rack Reverse Lunge';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Curtsy Lunge';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Bulgarian Split Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Front Rack Bulgarian Split Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Double Kettlebell Bulgarian Split Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Goblet Step-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Lateral Lunge';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Kettlebell Lunge Pass Through';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Double Kettlebell Military Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'One-Arm Kettlebell Military Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Alternating Kettlebell Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Kettlebell Seesaw Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Kettlebell See-Saw Push Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Kettlebell Arnold Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Kettlebell Seated Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Kettlebell Half-Kneeling Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Kettlebell Tall-Kneeling Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Kettlebell Z Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Double Kettlebell Z Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'One-Arm Kettlebell Para Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'One-Arm Kettlebell Push Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Double Kettlebell Push Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Double Kettlebell Push Jerk';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'One-Arm Kettlebell Jerk';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'One-Arm Kettlebell Split Jerk';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'One-Arm Kettlebell Clean and Jerk';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Double Kettlebell Jerk';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Kettlebell Thruster';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Double Kettlebell Thruster';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Kettlebell Clean and Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Double Kettlebell Clean and Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Kettlebell Sots Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Kettlebell Bottoms-Up Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Kettlebell Bent Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'One-Arm Kettlebell Floor Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Extended Range One-Arm Kettlebell Floor Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Leg-Over Kettlebell Floor Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Alternating Kettlebell Floor Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Double Kettlebell Floor Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Kettlebell Bench Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Double Kettlebell Bench Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Kettlebell Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Plyo Kettlebell Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'One-Arm Kettlebell Row';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Double Kettlebell Row';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Alternating Kettlebell Row';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Kettlebell Renegade Row';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Alternating Renegade Row';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Kettlebell Gorilla Row';
UPDATE public.movements SET "Movement Pattern #1" = 'Loaded Carry', pattern_credits = ARRAY['carry']::text[] WHERE "Movement" = 'Kettlebell Suitcase Carry';
UPDATE public.movements SET "Movement Pattern #1" = 'Loaded Carry', pattern_credits = ARRAY['carry']::text[] WHERE "Movement" = 'Kettlebell Farmer''s Carry';
UPDATE public.movements SET "Movement Pattern #1" = 'Loaded Carry', pattern_credits = ARRAY['carry']::text[] WHERE "Movement" = 'Kettlebell Racked Carry';
UPDATE public.movements SET "Movement Pattern #1" = 'Loaded Carry', pattern_credits = ARRAY['carry']::text[] WHERE "Movement" = 'Kettlebell Double Rack Carry';
UPDATE public.movements SET "Movement Pattern #1" = 'Loaded Carry', pattern_credits = ARRAY['carry']::text[] WHERE "Movement" = 'Kettlebell Overhead Carry';
UPDATE public.movements SET "Movement Pattern #1" = 'Loaded Carry', pattern_credits = ARRAY['carry']::text[] WHERE "Movement" = 'Kettlebell Double Overhead Carry';
UPDATE public.movements SET "Movement Pattern #1" = 'Loaded Carry', pattern_credits = ARRAY['carry']::text[] WHERE "Movement" = 'Kettlebell Waiter Carry';
UPDATE public.movements SET "Movement Pattern #1" = 'Loaded Carry', pattern_credits = ARRAY['carry']::text[] WHERE "Movement" = 'Kettlebell Bottoms-Up Carry';
UPDATE public.movements SET "Movement Pattern #1" = 'Loaded Carry', pattern_credits = ARRAY['carry']::text[] WHERE "Movement" = 'Kettlebell Mixed Rack Carry';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Kettlebell Windmill';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Advanced Kettlebell Windmill';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Kettlebell Overhead Windmill';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Double Kettlebell Windmill';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Kettlebell Halo';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Kettlebell Half-Kneeling Halo';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Kettlebell Around The Body';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Kettlebell Russian Twist';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Kettlebell Wood Chop';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Rotation', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Kettlebell Side Bend';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['get_up', 'push', 'rotation']::text[] WHERE "Movement" = 'Kettlebell Turkish Get-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['get_up', 'push', 'rotation']::text[] WHERE "Movement" = 'Kettlebell Turkish Get-Up (Lunge Style)';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['get_up', 'push', 'rotation']::text[] WHERE "Movement" = 'Kettlebell Turkish Get-Up (Squat Style)';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['get_up', 'push', 'rotation']::text[] WHERE "Movement" = 'Half Kettlebell Get-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Wide-Grip Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Close-Grip Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Diamond Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Incline Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Decline Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Knee Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Wall Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Staggered Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Clock Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Spiderman Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Hindu Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Plyometric Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Clap Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Archer Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Pseudo Planche Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Single-Arm Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Push-Up to Side Plank';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Body Triceps Press';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Bench Dips';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Triceps Dips';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Straight Bar Dip';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Korean Dip';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Handstand Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Pike Push-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Wall Walk';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Push', pattern_credits = ARRAY['push']::text[] WHERE "Movement" = 'Wall Handstand Hold';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Pull-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Chin-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Neutral-Grip Pull-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Wide-Grip Pull-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'V-Bar Pull-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Commando Pull-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Scapular Pull-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Negative Pull-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'L-Sit Pull-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Archer Pull-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Muscle-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Vertical Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Gorilla Chin-Up Crunch';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Inverted Row';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Wide-Grip Inverted Row';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Underhand Inverted Row';
UPDATE public.movements SET "Movement Pattern #1" = 'Horizontal Pull', pattern_credits = ARRAY['pull']::text[] WHERE "Movement" = 'Single-Arm Inverted Row';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Bodyweight Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Jump Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Bodyweight Pistol Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Sissy Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Shrimp Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Single-Leg Box Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Wall Sit';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Cossack Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Forward Lunge';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Reverse Lunge';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Walking Lunge';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Curtsy Lunge';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Lateral Lunge';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Bodyweight Bulgarian Split Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Step-Up with Knee Raise';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Duck Walk';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'High Knees';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Squat Thrust';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Burpee';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Bench Jump';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Box Jump';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Freehand Jump Squat';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Split Jump';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Scissors Jump';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Star Jump';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Rocket Jump';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Knee Tuck Jump';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Standing Long Jump';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Lateral Bound';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Standing Calf Raise';
UPDATE public.movements SET "Movement Pattern #1" = 'Knee Dominant', pattern_credits = ARRAY['squat']::text[] WHERE "Movement" = 'Single-Leg Calf Raise';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Glute Bridge';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Single-Leg Glute Bridge';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Bodyweight Hip Thrust';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Single-Leg Hip Thrust';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Frog Pump';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Glute Kickback';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Donkey Kick';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Fire Hydrant';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Rear Leg Raise';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Superman';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Prone Cobra';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Bodyweight Hyperextension';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Reverse Hyperextension';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Extension', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Bird Dog';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Natural Glute-Ham Raise';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Nordic Curl';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Bodyweight Good Morning';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Bodyweight Single-Leg Deadlift';
UPDATE public.movements SET "Movement Pattern #1" = 'Hip Hinge', pattern_credits = ARRAY['hinge']::text[] WHERE "Movement" = 'Inchworm';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Plank';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Rotation', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Side Plank';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Bear Plank';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Rotation', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Plank Shoulder Tap';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Plank Up-Down';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Rotation', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Copenhagen Plank';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Hollow Hold';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Hollow Rock';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Mountain Climber';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Bear Crawl';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Spider Crawl';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Dead Bug';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Russian Twist';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Bicycle Crunch';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Cross-Body Crunch';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Oblique Crunch';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Side Jackknife';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Rotation', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Heel Touches';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Toe Touches';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Groiners';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Crunch';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Decline Crunch';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Reverse Crunch';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'V-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Sit-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Jackknife Sit-Up';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Lying Leg Raise';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Hanging Leg Raise';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Hanging Knee Raise';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Hanging Pike';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Toes to Bar';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Leg Pull-In';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Flutter Kicks';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Scissor Kick';
UPDATE public.movements SET "Movement Pattern #1" = 'Rotational', pattern_credits = ARRAY['rotation']::text[] WHERE "Movement" = 'Windshield Wipers';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Dragon Flag';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'L-Sit';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Extension', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Stomach Vacuum';
UPDATE public.movements SET "Movement Pattern #1" = 'Anti-Rotation', pattern_credits = ARRAY['core']::text[] WHERE "Movement" = 'Side Leg Raise';

-- 4. Validate: every row credited, arrays legal, non-empty, and duplicate-free.
-- CHECK constraints can't contain subqueries, so dedupe-counting is delegated
-- to this small IMMUTABLE helper.
CREATE OR REPLACE FUNCTION public.array_distinct_count(arr text[])
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT count(DISTINCT c) FROM unnest(arr) AS c;
$$;

ALTER TABLE public.movements
  ALTER COLUMN pattern_credits SET NOT NULL;

ALTER TABLE public.movements
  DROP CONSTRAINT IF EXISTS movements_pattern_credits_check;

ALTER TABLE public.movements
  ADD CONSTRAINT movements_pattern_credits_check
    CHECK (
      cardinality(pattern_credits) > 0
      AND pattern_credits <@ ARRAY['hinge','squat','push','pull','carry','rotation','core','get_up']::text[]
      AND cardinality(pattern_credits) = public.array_distinct_count(pattern_credits)
    );
