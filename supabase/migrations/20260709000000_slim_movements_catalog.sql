-- PROD-153: Replace the non-commercially-licensed ~3,000-row movement catalog
-- (Strength to Overcome "Functional Fitness Exercise Database v2.9") with a
-- self-authored slim Kettlebell + Bodyweight catalog (~250 rows), and slim the
-- `movements` schema to only the fields the app consumes.
--
-- Rows are the source-of-truth CSV at scripts/data/movements.csv, validated by
-- scripts/ingest-movements.mjs. The INSERT block in step 7 is generated with
-- `node scripts/ingest-movements.mjs --emit-sql`; regenerate it there when the
-- CSV changes. The catalog is now reproducible on every `supabase db reset` and
-- auto-deploys to staging/prod via the supabase-* workflows.
--
-- FK-safety: user_movements.functional_movement_id is the ONLY FK to movements
-- (nullable, NO ACTION). Both of its consumers degrade gracefully to null, so we
-- null it, reload, and best-effort relink by normalized name.

-- The movements_catalog view depends on columns we retype below; drop it first
-- and recreate it (unchanged) at the end.
DROP VIEW IF EXISTS public.movements_catalog;

-- 1. Break the only FK before clearing rows.
UPDATE public.user_movements SET functional_movement_id = NULL;

-- 2. Clear the old, non-commercial catalog.
DELETE FROM public.movements;

-- 3. Drop the 24 columns no consumer reads.
ALTER TABLE public.movements
  DROP COLUMN "Short YouTube Demonstration",
  DROP COLUMN "In-Depth YouTube Explanation",
  DROP COLUMN "Prime Mover Muscle",
  DROP COLUMN "Secondary Muscle",
  DROP COLUMN "Tertiary Muscle",
  DROP COLUMN "Secondary Equipment",
  DROP COLUMN "# Secondary Items",
  DROP COLUMN "Posture",
  DROP COLUMN "Continuous or Alternating Arms",
  DROP COLUMN "Grip",
  DROP COLUMN "Load Position (Ending)",
  DROP COLUMN "Continuous or Alternating Legs",
  DROP COLUMN "Foot Elevation",
  DROP COLUMN "Combination Exercises",
  DROP COLUMN "Movement Pattern #2",
  DROP COLUMN "Movement Pattern #3",
  DROP COLUMN "Plane Of Motion #1",
  DROP COLUMN "Plane Of Motion #2",
  DROP COLUMN "Plane Of Motion #3",
  DROP COLUMN "Body Region",
  DROP COLUMN "Force Type",
  DROP COLUMN "Mechanics",
  DROP COLUMN "Laterality",
  DROP COLUMN "Primary Exercise Classification";

-- 4. Retype the surviving enum-backed columns to text (authoring flexibility;
--    the old enum wall made ingestion brittle). Column names are unchanged, so
--    the view + all three query sites keep working verbatim.
ALTER TABLE public.movements
  ALTER COLUMN "Primary Equipment" TYPE text USING "Primary Equipment"::text,
  ALTER COLUMN "Single or Double Arm" TYPE text USING "Single or Double Arm"::text,
  ALTER COLUMN "Target Muscle Group" TYPE text USING "Target Muscle Group"::text,
  ALTER COLUMN "Difficulty Level" TYPE text USING "Difficulty Level"::text,
  ALTER COLUMN "Movement Pattern #1" TYPE text USING "Movement Pattern #1"::text;

-- 5. Guard the load-bearing fields. These enforce the weight-mode reachability
--    inputs (equipment / arm / item-count, per movementWeightModeFilter.ts) and
--    keep Movement Pattern #1 inside the set pattern_debt_window recognizes.
ALTER TABLE public.movements
  ADD CONSTRAINT movements_primary_equipment_check
    CHECK ("Primary Equipment" IN ('Bodyweight', 'Kettlebell')),
  ADD CONSTRAINT movements_single_or_double_arm_check
    CHECK ("Single or Double Arm" IN ('Single Arm', 'Double Arm', 'No Arms')),
  ADD CONSTRAINT movements_primary_items_check
    CHECK ("# Primary Items" IN (1, 2)),
  ADD CONSTRAINT movements_movement_pattern_check
    CHECK ("Movement Pattern #1" IN (
      'Hip Hinge', 'Hip Dominant', 'Hip Extension', 'Knee Dominant',
      'Vertical Push', 'Horizontal Push', 'Vertical Pull', 'Horizontal Pull',
      'Loaded Carry', 'Rotational', 'Spinal Rotational'
    ));

-- 6. Drop the now-orphaned enum types (no column references them anymore).
DROP TYPE IF EXISTS "public"."Body Region";
DROP TYPE IF EXISTS "public"."Combination Exercises";
DROP TYPE IF EXISTS "public"."Continuous or Alternating";
DROP TYPE IF EXISTS "public"."Difficulty Level";
DROP TYPE IF EXISTS "public"."Equipment";
DROP TYPE IF EXISTS "public"."Exercise Classification";
DROP TYPE IF EXISTS "public"."Foot Elevation";
DROP TYPE IF EXISTS "public"."Force Type";
DROP TYPE IF EXISTS "public"."Grip";
DROP TYPE IF EXISTS "public"."Laterality";
DROP TYPE IF EXISTS "public"."Load Position";
DROP TYPE IF EXISTS "public"."Mechanics";
DROP TYPE IF EXISTS "public"."Movement Pattern";
DROP TYPE IF EXISTS "public"."Muscle Group";
DROP TYPE IF EXISTS "public"."Muscles";
DROP TYPE IF EXISTS "public"."Plane of Motion";
DROP TYPE IF EXISTS "public"."Posture";
DROP TYPE IF EXISTS "public"."Single or Double Arm";

-- 7. Load the self-authored catalog.
--    Generated from scripts/data/movements.csv via
--    `node scripts/ingest-movements.mjs --emit-sql`.
INSERT INTO public.movements ("Movement", "Primary Equipment", "# Primary Items", "Single or Double Arm", "Target Muscle Group", "Difficulty Level", "Movement Pattern #1") VALUES
  ('Kettlebell Swing', 'Kettlebell', 1, 'Double Arm', 'Hamstrings', 'Beginner', 'Hip Hinge'),
  ('One-Arm Kettlebell Swing', 'Kettlebell', 1, 'Single Arm', 'Hamstrings', 'Intermediate', 'Hip Hinge'),
  ('Double Kettlebell Swing', 'Kettlebell', 2, 'Double Arm', 'Hamstrings', 'Intermediate', 'Hip Hinge'),
  ('Alternating Kettlebell Swing', 'Kettlebell', 1, 'Single Arm', 'Hamstrings', 'Intermediate', 'Hip Hinge'),
  ('Kettlebell Dead Clean', 'Kettlebell', 1, 'Single Arm', 'Hamstrings', 'Intermediate', 'Hip Hinge'),
  ('Kettlebell Hang Clean', 'Kettlebell', 1, 'Single Arm', 'Hamstrings', 'Intermediate', 'Hip Hinge'),
  ('One-Arm Kettlebell Clean', 'Kettlebell', 1, 'Single Arm', 'Hamstrings', 'Intermediate', 'Hip Hinge'),
  ('Bottoms-Up Kettlebell Clean', 'Kettlebell', 1, 'Single Arm', 'Forearms', 'Intermediate', 'Hip Hinge'),
  ('Bottoms-Up Kettlebell Clean From Hang', 'Kettlebell', 1, 'Single Arm', 'Forearms', 'Intermediate', 'Hip Hinge'),
  ('Double Kettlebell Clean', 'Kettlebell', 2, 'Double Arm', 'Shoulders', 'Intermediate', 'Hip Hinge'),
  ('Double Kettlebell Dead Clean', 'Kettlebell', 2, 'Double Arm', 'Hamstrings', 'Intermediate', 'Hip Hinge'),
  ('Double Kettlebell Alternating Hang Clean', 'Kettlebell', 2, 'Double Arm', 'Hamstrings', 'Intermediate', 'Hip Hinge'),
  ('Alternating Kettlebell Hang Clean', 'Kettlebell', 2, 'Double Arm', 'Hamstrings', 'Intermediate', 'Hip Hinge'),
  ('One-Arm Kettlebell Snatch', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Expert', 'Hip Hinge'),
  ('One-Arm Kettlebell Split Snatch', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Expert', 'Hip Hinge'),
  ('Kettlebell Dead Snatch', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Expert', 'Hip Hinge'),
  ('Kettlebell Hang Snatch', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Expert', 'Hip Hinge'),
  ('Double Kettlebell Snatch', 'Kettlebell', 2, 'Double Arm', 'Shoulders', 'Expert', 'Hip Hinge'),
  ('Kettlebell Sumo High Pull', 'Kettlebell', 1, 'Double Arm', 'Trapezius', 'Intermediate', 'Hip Hinge'),
  ('One-Arm Kettlebell High Pull', 'Kettlebell', 1, 'Single Arm', 'Trapezius', 'Intermediate', 'Hip Hinge'),
  ('Double Kettlebell High Pull', 'Kettlebell', 2, 'Double Arm', 'Trapezius', 'Intermediate', 'Hip Hinge'),
  ('Kettlebell Snatch Pull', 'Kettlebell', 1, 'Single Arm', 'Trapezius', 'Intermediate', 'Hip Hinge'),
  ('Kettlebell Figure 8', 'Kettlebell', 1, 'Double Arm', 'Abdominals', 'Intermediate', 'Hip Hinge'),
  ('Kettlebell Pass Between The Legs', 'Kettlebell', 1, 'Double Arm', 'Abdominals', 'Intermediate', 'Hip Hinge'),
  ('Kettlebell Pirate Ships', 'Kettlebell', 1, 'Double Arm', 'Shoulders', 'Beginner', 'Hip Hinge'),
  ('Kettlebell Hike Pass', 'Kettlebell', 1, 'Double Arm', 'Hamstrings', 'Beginner', 'Hip Hinge'),
  ('Kettlebell Deadlift', 'Kettlebell', 1, 'Double Arm', 'Hamstrings', 'Beginner', 'Hip Hinge'),
  ('Kettlebell Sumo Deadlift', 'Kettlebell', 1, 'Double Arm', 'Hamstrings', 'Beginner', 'Hip Hinge'),
  ('Kettlebell Suitcase Deadlift', 'Kettlebell', 2, 'Double Arm', 'Hamstrings', 'Beginner', 'Hip Hinge'),
  ('Kettlebell Romanian Deadlift', 'Kettlebell', 2, 'Double Arm', 'Hamstrings', 'Beginner', 'Hip Hinge'),
  ('Double Kettlebell Romanian Deadlift', 'Kettlebell', 2, 'Double Arm', 'Hamstrings', 'Beginner', 'Hip Hinge'),
  ('Kettlebell Single-Leg Deadlift', 'Kettlebell', 1, 'Single Arm', 'Hamstrings', 'Intermediate', 'Hip Hinge'),
  ('Kettlebell Single-Leg Romanian Deadlift', 'Kettlebell', 1, 'Single Arm', 'Hamstrings', 'Intermediate', 'Hip Hinge'),
  ('Kettlebell Staggered Deadlift', 'Kettlebell', 1, 'Single Arm', 'Hamstrings', 'Intermediate', 'Hip Hinge'),
  ('Kettlebell Good Morning', 'Kettlebell', 1, 'Double Arm', 'Hamstrings', 'Intermediate', 'Hip Hinge'),
  ('Goblet Squat', 'Kettlebell', 1, 'Double Arm', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Double Kettlebell Front Squat', 'Kettlebell', 2, 'Double Arm', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Kettlebell Pistol Squat', 'Kettlebell', 1, 'Double Arm', 'Quadriceps', 'Expert', 'Knee Dominant'),
  ('One-Arm Overhead Kettlebell Squat', 'Kettlebell', 1, 'Single Arm', 'Quadriceps', 'Expert', 'Knee Dominant'),
  ('Kettlebell Front Rack Squat', 'Kettlebell', 1, 'Single Arm', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Kettlebell Cossack Squat', 'Kettlebell', 1, 'Double Arm', 'Adductors', 'Intermediate', 'Knee Dominant'),
  ('Kettlebell Goblet Reverse Lunge', 'Kettlebell', 1, 'Double Arm', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Kettlebell Racked Reverse Lunge', 'Kettlebell', 1, 'Single Arm', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Kettlebell Goblet Forward Lunge', 'Kettlebell', 1, 'Double Arm', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Kettlebell Racked Forward Lunge', 'Kettlebell', 1, 'Single Arm', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Kettlebell Goblet Walking Lunge', 'Kettlebell', 1, 'Double Arm', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Kettlebell Overhead Reverse Lunge', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Knee Dominant'),
  ('Double Kettlebell Front Rack Reverse Lunge', 'Kettlebell', 2, 'Double Arm', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Kettlebell Curtsy Lunge', 'Kettlebell', 1, 'Single Arm', 'Glutes', 'Intermediate', 'Knee Dominant'),
  ('Kettlebell Bulgarian Split Squat', 'Kettlebell', 1, 'Double Arm', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Kettlebell Front Rack Bulgarian Split Squat', 'Kettlebell', 1, 'Single Arm', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Double Kettlebell Bulgarian Split Squat', 'Kettlebell', 2, 'Double Arm', 'Quadriceps', 'Expert', 'Knee Dominant'),
  ('Kettlebell Goblet Step-Up', 'Kettlebell', 1, 'Double Arm', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Kettlebell Lateral Lunge', 'Kettlebell', 1, 'Double Arm', 'Adductors', 'Intermediate', 'Knee Dominant'),
  ('Kettlebell Lunge Pass Through', 'Kettlebell', 1, 'Double Arm', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Double Kettlebell Military Press', 'Kettlebell', 2, 'Double Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('One-Arm Kettlebell Military Press', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Alternating Kettlebell Press', 'Kettlebell', 2, 'Double Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Kettlebell Seesaw Press', 'Kettlebell', 2, 'Double Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Kettlebell See-Saw Push Press', 'Kettlebell', 2, 'Double Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Kettlebell Arnold Press', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Kettlebell Seated Press', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Kettlebell Half-Kneeling Press', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Kettlebell Tall-Kneeling Press', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Kettlebell Z Press', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Double Kettlebell Z Press', 'Kettlebell', 2, 'Double Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('One-Arm Kettlebell Para Press', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('One-Arm Kettlebell Push Press', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Double Kettlebell Push Press', 'Kettlebell', 2, 'Double Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Double Kettlebell Push Jerk', 'Kettlebell', 2, 'Double Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('One-Arm Kettlebell Jerk', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('One-Arm Kettlebell Split Jerk', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('One-Arm Kettlebell Clean and Jerk', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Double Kettlebell Jerk', 'Kettlebell', 2, 'Double Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Kettlebell Thruster', 'Kettlebell', 1, 'Double Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Double Kettlebell Thruster', 'Kettlebell', 2, 'Double Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Kettlebell Clean and Press', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Double Kettlebell Clean and Press', 'Kettlebell', 2, 'Double Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Kettlebell Sots Press', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Expert', 'Vertical Push'),
  ('Kettlebell Bottoms-Up Press', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Kettlebell Bent Press', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Expert', 'Vertical Push'),
  ('One-Arm Kettlebell Floor Press', 'Kettlebell', 1, 'Single Arm', 'Chest', 'Intermediate', 'Horizontal Push'),
  ('Extended Range One-Arm Kettlebell Floor Press', 'Kettlebell', 1, 'Single Arm', 'Chest', 'Beginner', 'Horizontal Push'),
  ('Leg-Over Kettlebell Floor Press', 'Kettlebell', 1, 'Single Arm', 'Chest', 'Intermediate', 'Horizontal Push'),
  ('Alternating Kettlebell Floor Press', 'Kettlebell', 2, 'Double Arm', 'Chest', 'Beginner', 'Horizontal Push'),
  ('Double Kettlebell Floor Press', 'Kettlebell', 2, 'Double Arm', 'Chest', 'Beginner', 'Horizontal Push'),
  ('Kettlebell Bench Press', 'Kettlebell', 1, 'Single Arm', 'Chest', 'Intermediate', 'Horizontal Push'),
  ('Double Kettlebell Bench Press', 'Kettlebell', 2, 'Double Arm', 'Chest', 'Intermediate', 'Horizontal Push'),
  ('Kettlebell Push-Up', 'Kettlebell', 2, 'Double Arm', 'Chest', 'Intermediate', 'Horizontal Push'),
  ('Plyo Kettlebell Push-Up', 'Kettlebell', 2, 'Double Arm', 'Chest', 'Expert', 'Horizontal Push'),
  ('One-Arm Kettlebell Row', 'Kettlebell', 1, 'Single Arm', 'Back', 'Intermediate', 'Horizontal Pull'),
  ('Double Kettlebell Row', 'Kettlebell', 2, 'Double Arm', 'Back', 'Intermediate', 'Horizontal Pull'),
  ('Alternating Kettlebell Row', 'Kettlebell', 2, 'Double Arm', 'Back', 'Intermediate', 'Horizontal Pull'),
  ('Kettlebell Renegade Row', 'Kettlebell', 2, 'Double Arm', 'Back', 'Expert', 'Horizontal Pull'),
  ('Alternating Renegade Row', 'Kettlebell', 2, 'Double Arm', 'Back', 'Expert', 'Horizontal Pull'),
  ('Kettlebell Gorilla Row', 'Kettlebell', 2, 'Double Arm', 'Back', 'Intermediate', 'Horizontal Pull'),
  ('Kettlebell Suitcase Carry', 'Kettlebell', 1, 'Single Arm', 'Forearms', 'Beginner', 'Loaded Carry'),
  ('Kettlebell Farmer''s Carry', 'Kettlebell', 2, 'Double Arm', 'Forearms', 'Beginner', 'Loaded Carry'),
  ('Kettlebell Racked Carry', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Loaded Carry'),
  ('Kettlebell Double Rack Carry', 'Kettlebell', 2, 'Double Arm', 'Shoulders', 'Intermediate', 'Loaded Carry'),
  ('Kettlebell Overhead Carry', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Loaded Carry'),
  ('Kettlebell Double Overhead Carry', 'Kettlebell', 2, 'Double Arm', 'Shoulders', 'Expert', 'Loaded Carry'),
  ('Kettlebell Waiter Carry', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Loaded Carry'),
  ('Kettlebell Bottoms-Up Carry', 'Kettlebell', 1, 'Single Arm', 'Forearms', 'Intermediate', 'Loaded Carry'),
  ('Kettlebell Mixed Rack Carry', 'Kettlebell', 2, 'Double Arm', 'Forearms', 'Intermediate', 'Loaded Carry'),
  ('Kettlebell Windmill', 'Kettlebell', 1, 'Single Arm', 'Abdominals', 'Intermediate', 'Rotational'),
  ('Advanced Kettlebell Windmill', 'Kettlebell', 1, 'Single Arm', 'Abdominals', 'Intermediate', 'Rotational'),
  ('Kettlebell Overhead Windmill', 'Kettlebell', 1, 'Single Arm', 'Abdominals', 'Expert', 'Rotational'),
  ('Double Kettlebell Windmill', 'Kettlebell', 2, 'Double Arm', 'Abdominals', 'Intermediate', 'Rotational'),
  ('Kettlebell Halo', 'Kettlebell', 1, 'Double Arm', 'Shoulders', 'Beginner', 'Rotational'),
  ('Kettlebell Half-Kneeling Halo', 'Kettlebell', 1, 'Double Arm', 'Shoulders', 'Beginner', 'Rotational'),
  ('Kettlebell Around The Body', 'Kettlebell', 1, 'Double Arm', 'Abdominals', 'Beginner', 'Rotational'),
  ('Kettlebell Russian Twist', 'Kettlebell', 1, 'Double Arm', 'Abdominals', 'Intermediate', 'Rotational'),
  ('Kettlebell Wood Chop', 'Kettlebell', 1, 'Double Arm', 'Abdominals', 'Beginner', 'Rotational'),
  ('Kettlebell Side Bend', 'Kettlebell', 1, 'Single Arm', 'Abdominals', 'Beginner', 'Rotational'),
  ('Kettlebell Turkish Get-Up', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Kettlebell Turkish Get-Up (Lunge Style)', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Kettlebell Turkish Get-Up (Squat Style)', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Half Kettlebell Get-Up', 'Kettlebell', 1, 'Single Arm', 'Shoulders', 'Beginner', 'Vertical Push'),
  ('Push-Up', 'Bodyweight', 1, 'Double Arm', 'Chest', 'Beginner', 'Horizontal Push'),
  ('Wide-Grip Push-Up', 'Bodyweight', 1, 'Double Arm', 'Chest', 'Beginner', 'Horizontal Push'),
  ('Close-Grip Push-Up', 'Bodyweight', 1, 'Double Arm', 'Triceps', 'Intermediate', 'Horizontal Push'),
  ('Diamond Push-Up', 'Bodyweight', 1, 'Double Arm', 'Triceps', 'Intermediate', 'Horizontal Push'),
  ('Incline Push-Up', 'Bodyweight', 1, 'Double Arm', 'Chest', 'Beginner', 'Horizontal Push'),
  ('Decline Push-Up', 'Bodyweight', 1, 'Double Arm', 'Chest', 'Beginner', 'Horizontal Push'),
  ('Knee Push-Up', 'Bodyweight', 1, 'Double Arm', 'Chest', 'Beginner', 'Horizontal Push'),
  ('Wall Push-Up', 'Bodyweight', 1, 'Double Arm', 'Chest', 'Beginner', 'Horizontal Push'),
  ('Staggered Push-Up', 'Bodyweight', 1, 'Double Arm', 'Chest', 'Beginner', 'Horizontal Push'),
  ('Clock Push-Up', 'Bodyweight', 1, 'Double Arm', 'Chest', 'Intermediate', 'Horizontal Push'),
  ('Spiderman Push-Up', 'Bodyweight', 1, 'Double Arm', 'Chest', 'Intermediate', 'Horizontal Push'),
  ('Hindu Push-Up', 'Bodyweight', 1, 'Double Arm', 'Chest', 'Intermediate', 'Horizontal Push'),
  ('Plyometric Push-Up', 'Bodyweight', 1, 'Double Arm', 'Chest', 'Intermediate', 'Horizontal Push'),
  ('Clap Push-Up', 'Bodyweight', 1, 'Double Arm', 'Chest', 'Intermediate', 'Horizontal Push'),
  ('Archer Push-Up', 'Bodyweight', 1, 'Double Arm', 'Chest', 'Expert', 'Horizontal Push'),
  ('Pseudo Planche Push-Up', 'Bodyweight', 1, 'Double Arm', 'Shoulders', 'Expert', 'Horizontal Push'),
  ('Single-Arm Push-Up', 'Bodyweight', 1, 'Single Arm', 'Chest', 'Expert', 'Horizontal Push'),
  ('Push-Up to Side Plank', 'Bodyweight', 1, 'Double Arm', 'Chest', 'Beginner', 'Horizontal Push'),
  ('Body Triceps Press', 'Bodyweight', 1, 'Double Arm', 'Triceps', 'Beginner', 'Horizontal Push'),
  ('Bench Dips', 'Bodyweight', 1, 'Double Arm', 'Triceps', 'Beginner', 'Vertical Push'),
  ('Triceps Dips', 'Bodyweight', 1, 'Double Arm', 'Triceps', 'Beginner', 'Vertical Push'),
  ('Straight Bar Dip', 'Bodyweight', 1, 'Double Arm', 'Triceps', 'Intermediate', 'Vertical Push'),
  ('Korean Dip', 'Bodyweight', 1, 'Double Arm', 'Triceps', 'Expert', 'Vertical Push'),
  ('Handstand Push-Up', 'Bodyweight', 1, 'Double Arm', 'Shoulders', 'Expert', 'Vertical Push'),
  ('Pike Push-Up', 'Bodyweight', 1, 'Double Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Wall Walk', 'Bodyweight', 1, 'Double Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Wall Handstand Hold', 'Bodyweight', 1, 'Double Arm', 'Shoulders', 'Intermediate', 'Vertical Push'),
  ('Pull-Up', 'Bodyweight', 1, 'Double Arm', 'Back', 'Beginner', 'Vertical Pull'),
  ('Chin-Up', 'Bodyweight', 1, 'Double Arm', 'Back', 'Beginner', 'Vertical Pull'),
  ('Neutral-Grip Pull-Up', 'Bodyweight', 1, 'Double Arm', 'Back', 'Beginner', 'Vertical Pull'),
  ('Wide-Grip Pull-Up', 'Bodyweight', 1, 'Double Arm', 'Back', 'Intermediate', 'Vertical Pull'),
  ('V-Bar Pull-Up', 'Bodyweight', 1, 'Double Arm', 'Back', 'Beginner', 'Vertical Pull'),
  ('Commando Pull-Up', 'Bodyweight', 1, 'Double Arm', 'Back', 'Intermediate', 'Vertical Pull'),
  ('Scapular Pull-Up', 'Bodyweight', 1, 'Double Arm', 'Back', 'Beginner', 'Vertical Pull'),
  ('Negative Pull-Up', 'Bodyweight', 1, 'Double Arm', 'Back', 'Beginner', 'Vertical Pull'),
  ('L-Sit Pull-Up', 'Bodyweight', 1, 'Double Arm', 'Back', 'Expert', 'Vertical Pull'),
  ('Archer Pull-Up', 'Bodyweight', 1, 'Double Arm', 'Back', 'Expert', 'Vertical Pull'),
  ('Muscle-Up', 'Bodyweight', 1, 'Double Arm', 'Back', 'Expert', 'Vertical Pull'),
  ('Gorilla Chin-Up Crunch', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Intermediate', 'Vertical Pull'),
  ('Inverted Row', 'Bodyweight', 1, 'Double Arm', 'Back', 'Beginner', 'Horizontal Pull'),
  ('Wide-Grip Inverted Row', 'Bodyweight', 1, 'Double Arm', 'Back', 'Beginner', 'Horizontal Pull'),
  ('Underhand Inverted Row', 'Bodyweight', 1, 'Double Arm', 'Back', 'Beginner', 'Horizontal Pull'),
  ('Single-Arm Inverted Row', 'Bodyweight', 1, 'Single Arm', 'Back', 'Intermediate', 'Horizontal Pull'),
  ('Bodyweight Squat', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Jump Squat', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Bodyweight Pistol Squat', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Expert', 'Knee Dominant'),
  ('Sissy Squat', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Shrimp Squat', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Expert', 'Knee Dominant'),
  ('Single-Leg Box Squat', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Wall Sit', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Cossack Squat', 'Bodyweight', 1, 'No Arms', 'Adductors', 'Intermediate', 'Knee Dominant'),
  ('Forward Lunge', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Reverse Lunge', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Walking Lunge', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Curtsy Lunge', 'Bodyweight', 1, 'No Arms', 'Glutes', 'Beginner', 'Knee Dominant'),
  ('Lateral Lunge', 'Bodyweight', 1, 'No Arms', 'Adductors', 'Beginner', 'Knee Dominant'),
  ('Bodyweight Bulgarian Split Squat', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Step-Up with Knee Raise', 'Bodyweight', 1, 'No Arms', 'Glutes', 'Beginner', 'Knee Dominant'),
  ('Duck Walk', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('High Knees', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Squat Thrust', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Burpee', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Bench Jump', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Box Jump', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Freehand Jump Squat', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Intermediate', 'Knee Dominant'),
  ('Split Jump', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Scissors Jump', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Star Jump', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Rocket Jump', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Knee Tuck Jump', 'Bodyweight', 1, 'No Arms', 'Hamstrings', 'Beginner', 'Knee Dominant'),
  ('Standing Long Jump', 'Bodyweight', 1, 'No Arms', 'Quadriceps', 'Beginner', 'Knee Dominant'),
  ('Lateral Bound', 'Bodyweight', 1, 'No Arms', 'Adductors', 'Beginner', 'Knee Dominant'),
  ('Standing Calf Raise', 'Bodyweight', 1, 'No Arms', 'Calves', 'Beginner', 'Knee Dominant'),
  ('Single-Leg Calf Raise', 'Bodyweight', 1, 'No Arms', 'Calves', 'Beginner', 'Knee Dominant'),
  ('Glute Bridge', 'Bodyweight', 1, 'No Arms', 'Glutes', 'Beginner', 'Hip Extension'),
  ('Single-Leg Glute Bridge', 'Bodyweight', 1, 'No Arms', 'Glutes', 'Beginner', 'Hip Extension'),
  ('Bodyweight Hip Thrust', 'Bodyweight', 1, 'No Arms', 'Glutes', 'Beginner', 'Hip Extension'),
  ('Single-Leg Hip Thrust', 'Bodyweight', 1, 'No Arms', 'Glutes', 'Intermediate', 'Hip Extension'),
  ('Frog Pump', 'Bodyweight', 1, 'No Arms', 'Glutes', 'Beginner', 'Hip Extension'),
  ('Glute Kickback', 'Bodyweight', 1, 'No Arms', 'Glutes', 'Beginner', 'Hip Extension'),
  ('Donkey Kick', 'Bodyweight', 1, 'No Arms', 'Glutes', 'Beginner', 'Hip Extension'),
  ('Fire Hydrant', 'Bodyweight', 1, 'No Arms', 'Glutes', 'Beginner', 'Hip Extension'),
  ('Rear Leg Raise', 'Bodyweight', 1, 'No Arms', 'Glutes', 'Beginner', 'Hip Extension'),
  ('Superman', 'Bodyweight', 1, 'No Arms', 'Back', 'Beginner', 'Hip Extension'),
  ('Prone Cobra', 'Bodyweight', 1, 'No Arms', 'Back', 'Beginner', 'Hip Extension'),
  ('Bodyweight Hyperextension', 'Bodyweight', 1, 'No Arms', 'Back', 'Intermediate', 'Hip Extension'),
  ('Reverse Hyperextension', 'Bodyweight', 1, 'No Arms', 'Glutes', 'Intermediate', 'Hip Extension'),
  ('Bird Dog', 'Bodyweight', 1, 'No Arms', 'Back', 'Beginner', 'Hip Extension'),
  ('Natural Glute-Ham Raise', 'Bodyweight', 1, 'No Arms', 'Hamstrings', 'Intermediate', 'Hip Hinge'),
  ('Nordic Curl', 'Bodyweight', 1, 'No Arms', 'Hamstrings', 'Expert', 'Hip Hinge'),
  ('Bodyweight Good Morning', 'Bodyweight', 1, 'No Arms', 'Hamstrings', 'Beginner', 'Hip Hinge'),
  ('Bodyweight Single-Leg Deadlift', 'Bodyweight', 1, 'No Arms', 'Hamstrings', 'Beginner', 'Hip Hinge'),
  ('Inchworm', 'Bodyweight', 1, 'Double Arm', 'Hamstrings', 'Beginner', 'Hip Hinge'),
  ('Plank', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Beginner', 'Rotational'),
  ('Side Plank', 'Bodyweight', 1, 'Single Arm', 'Abdominals', 'Beginner', 'Rotational'),
  ('Bear Plank', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Beginner', 'Rotational'),
  ('Plank Shoulder Tap', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Beginner', 'Rotational'),
  ('Plank Up-Down', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Intermediate', 'Rotational'),
  ('Copenhagen Plank', 'Bodyweight', 1, 'Single Arm', 'Adductors', 'Expert', 'Rotational'),
  ('Hollow Hold', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Intermediate', 'Rotational'),
  ('Hollow Rock', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Intermediate', 'Rotational'),
  ('Mountain Climber', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Beginner', 'Rotational'),
  ('Bear Crawl', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Beginner', 'Rotational'),
  ('Spider Crawl', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Beginner', 'Rotational'),
  ('Dead Bug', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('Russian Twist', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Intermediate', 'Rotational'),
  ('Bicycle Crunch', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('Cross-Body Crunch', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('Oblique Crunch', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('Side Jackknife', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('Heel Touches', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('Toe Touches', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('Groiners', 'Bodyweight', 1, 'Double Arm', 'Adductors', 'Intermediate', 'Rotational'),
  ('Crunch', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('Decline Crunch', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Intermediate', 'Rotational'),
  ('Reverse Crunch', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('V-Up', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Intermediate', 'Rotational'),
  ('Sit-Up', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('Jackknife Sit-Up', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('Lying Leg Raise', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('Hanging Leg Raise', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Expert', 'Rotational'),
  ('Hanging Knee Raise', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Intermediate', 'Rotational'),
  ('Hanging Pike', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Expert', 'Rotational'),
  ('Toes to Bar', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Expert', 'Rotational'),
  ('Leg Pull-In', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('Flutter Kicks', 'Bodyweight', 1, 'No Arms', 'Glutes', 'Beginner', 'Rotational'),
  ('Scissor Kick', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('Windshield Wipers', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Expert', 'Rotational'),
  ('Dragon Flag', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Expert', 'Rotational'),
  ('L-Sit', 'Bodyweight', 1, 'Double Arm', 'Abdominals', 'Expert', 'Rotational'),
  ('Stomach Vacuum', 'Bodyweight', 1, 'No Arms', 'Abdominals', 'Beginner', 'Rotational'),
  ('Side Leg Raise', 'Bodyweight', 1, 'No Arms', 'Adductors', 'Beginner', 'Rotational');

-- 8. Recreate the search view (unchanged: all 5 of its columns survive).
CREATE OR REPLACE VIEW public.movements_catalog
WITH (security_invoker = true)
AS
SELECT
  id,
  "Movement" AS name,
  "Primary Equipment" AS primary_equipment,
  "# Primary Items" AS primary_item_count,
  "Single or Double Arm" AS single_or_double_arm
FROM public.movements;

GRANT SELECT ON public.movements_catalog TO authenticated;

-- 9. Best-effort relink existing user_movements to the new catalog by
--    normalized (case-insensitive) canonical name. Unmatched rows stay null and
--    degrade gracefully (recentMovementMatchesWeightMode -> true;
--    pattern_debt_window LEFT JOIN -> excluded from bucketing).
UPDATE public.user_movements u
SET functional_movement_id = m.id
FROM public.movements m
WHERE u.functional_movement_id IS NULL
  AND lower(u.canonical_name) = lower(m."Movement");
