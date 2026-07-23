-- Seed the shared "Kettlebell Mile" program (Dr. Mike Prevost, StrongFirst).
-- Public + system-owned (owner_id NULL, is_public true) so every user sees it
-- and can one-tap "Start"; enrolling clones it into an editable copy
-- (enroll_in_program). Idempotent on slug: a re-run (or fresh env) skips
-- re-seeding sessions. This is a MIGRATION (not seed.sql) so it also reaches
-- staging/production, where seed.sql never runs. Surfaced only behind the
-- `programs` feature flag, like DFW.
--
-- Source: https://www.strongfirst.com/the-kettlebell-mile/ -- free and complete
-- on the page. Carry a kettlebell suitcase-style for one mile, switching hands
-- as often as you like, as fast as you can. Once a week. Challenge weight is
-- 24 kg (men) / 16 kg (women), which Prevost frames as 20-30% of bodyweight --
-- the crossover point where strength and aerobic capacity matter equally.
-- Benchmarks: ~15 min fast walk, 11-13 min jogging, 9-11 min very good,
-- sub-9 min very very good.
--
-- This is the catalog's first carry-centric program. It is also the first to use
-- timed rungs (PROD-200): `timedRungs: true` reinterprets each repScheme entry
-- as SECONDS, and the runtime auto-advances when the rung's countdown expires.
--
-- MODELING DECISIONS (the product-review-worthy calls):
--
--   * DISTANCE -> TIME. The source prescribes one MILE; the app has no distance
--     unit, only reps and (now) seconds. So the program is an adaptation: every
--     session prescribes time under load, not distance. This is the same class
--     of approximation as Easy Strength's "6x1, add weight each set" day. The
--     test session's workoutDetails is explicit that the user walks their actual
--     mile and finishes the workout when the mile is done -- the 15-minute
--     prescription is the entry benchmark pace, not a box to fill.
--
--   * THE 8-WEEK LADDER IS AUTHORED, NOT SOURCED. Prevost gives the protocol and
--     the benchmarks but only says to "build up to the distance, then improve
--     speed." The week-by-week build below (6 -> 16 min of carrying, taper, test)
--     is ours. Anyone revising it is not contradicting the source.
--
--   * ONE-HANDED LOADING DOES THE HAND-SWITCHING. weightTwoValue = 0 (not NULL)
--     puts the carry in Single/'1h' mode, so the runtime MIRRORS every rung per
--     hand (shouldMirrorReps / goToNextSide) -- which is exactly the source's
--     "switching hands as often as you want," and it enforces an even split.
--     Consequence: each repScheme entry is the PER-HAND segment, so a session's
--     total carrying time is sum(repScheme) x 2. The details string on each
--     session states the total so the number on screen is never a surprise.
--
--   * workoutGoalUnits 'rounds' with workoutGoal 1: one round = the whole
--     prescribed ladder completed once, the same convention the Easy Strength
--     seed uses. intervalTimer MUST stay 0 -- it and timed rungs both drive
--     auto-advance, and the builder treats them as mutually exclusive.
--
--   * 24 kg is a PLACEHOLDER, as in every other seed; the enrollment weight
--     picker pre-fills single-bell from deriveStartingWeight and the user sets
--     their own 20-30% bodyweight load.
--
-- 8 trackable sessions (seq 0-7 = 8 weeks x 1 day). num_weeks=8, days_per_week=1.

-- Session-local helper (pg_temp: auto-dropped at connection end, never persisted
-- to the committed schema) building the WorkoutOptions JSONB for one session.
-- Shape MUST match Omit<WorkoutOptions,'startedAt'> exactly (camelCase keys).
-- p_segments holds the PER-HAND carry segments in seconds.
CREATE OR REPLACE FUNCTION pg_temp.mile_options(p_segments INT[], p_details TEXT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'complexSet', false,
    'intervalTimer', 0,
    'restTimer', 0,
    'workoutGoal', 1,
    'workoutGoalUnits', 'rounds',
    'workoutDetails', p_details,
    'sharedWeightOneUnit', NULL,
    'sharedWeightOneValue', NULL,
    'sharedWeightTwoUnit', NULL,
    'sharedWeightTwoValue', NULL,
    'movements', jsonb_build_array(
      jsonb_build_object(
        'movementName', 'Kettlebell Suitcase Carry',
        'repScheme', to_jsonb(p_segments),
        'timedRungs', true,
        'weightOneUnit', 'kilograms', 'weightOneValue', 24,
        'weightTwoUnit', NULL, 'weightTwoValue', 0)
    ));
$$;

DO $$
DECLARE
  v_program_id UUID;
BEGIN
  INSERT INTO programs (owner_id, slug, title, description, author_name, num_weeks, days_per_week, is_public)
  VALUES (NULL, 'kettlebell-mile',
          'The Kettlebell Mile',
          'One suitcase carry, once a week, for eight weeks. Build time under '
          'load from six minutes to sixteen, taper, then walk your mile with a '
          'bell in one hand as fast as you can. Trains strength and aerobic '
          'capacity at the same time, and your obliques will have opinions.',
          'Dr. Mike Prevost (StrongFirst)', 8, 1, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_program_id;

  -- If the row already existed, skip re-seeding sessions.
  IF v_program_id IS NULL THEN
    RAISE NOTICE 'Kettlebell Mile program already seeded; skipping sessions.';
    RETURN;
  END IF;

  -- Per-hand segments in seconds; total carrying time is double (each rung is
  -- mirrored left then right). Build 6 -> 16 min, taper to 12, then test.
  INSERT INTO program_sessions
    (program_id, sequence_index, week_number, day_number, title, workout_options)
  VALUES
    (v_program_id, 0, 1, 1, 'Build - 6 min',
     pg_temp.mile_options(ARRAY[60, 60, 60]::INT[],
       'Kettlebell Mile W1 - Build. Three carries per hand, 1:00 each = 6 min total under load. '
       'Walk, do not race. Set the bell down between rungs if your posture starts to lean. '
       'Load is a placeholder: aim for 20-30% of bodyweight (24 kg men / 16 kg women is the challenge standard).')),
    (v_program_id, 1, 2, 1, 'Build - 8 min',
     pg_temp.mile_options(ARRAY[80, 80, 80]::INT[],
       'Kettlebell Mile W2 - Build. Three carries per hand, 1:20 each = 8 min total under load. '
       'Same load as week 1. Keep your ribs stacked over your hips; the unloaded side is doing the work.')),
    (v_program_id, 2, 3, 1, 'Build - 10 min',
     pg_temp.mile_options(ARRAY[100, 100, 100]::INT[],
       'Kettlebell Mile W3 - Build. Three carries per hand, 1:40 each = 10 min total under load. '
       'If your grip fails before your legs do, that is the point of the drill - keep the weight.')),
    (v_program_id, 3, 4, 1, 'Build - 12 min',
     pg_temp.mile_options(ARRAY[120, 120, 120]::INT[],
       'Kettlebell Mile W4 - Build. Three carries per hand, 2:00 each = 12 min total under load. '
       'Roughly the duration of a good mile. Breathe through your nose if you can.')),
    (v_program_id, 4, 5, 1, 'Build - 14 min',
     pg_temp.mile_options(ARRAY[140, 140, 140]::INT[],
       'Kettlebell Mile W5 - Build. Three carries per hand, 2:20 each = 14 min total under load. '
       'Longest week so far. Walk a straight line - drifting sideways means the anti-lateral-flexion work is slipping.')),
    (v_program_id, 5, 6, 1, 'Build - 16 min',
     pg_temp.mile_options(ARRAY[160, 160, 160]::INT[],
       'Kettlebell Mile W6 - Build. Three carries per hand, 2:40 each = 16 min total under load. '
       'Peak volume. This should feel harder than the test will.')),
    (v_program_id, 6, 7, 1, 'Taper - 12 min',
     pg_temp.mile_options(ARRAY[120, 120, 120]::INT[],
       'Kettlebell Mile W7 - Taper. Three carries per hand, 2:00 each = 12 min total under load. '
       'Deliberately easier than week 6. Move well, save the effort for the test.')),
    (v_program_id, 7, 8, 1, 'THE MILE',
     pg_temp.mile_options(ARRAY[150, 150, 150]::INT[],
       'Kettlebell Mile W8 - THE TEST. Carry the bell one mile, suitcase style, as fast as you can - '
       'the clock runs while you rest. The rungs (three per hand, 2:30 each = 15 min) are a hand-switch '
       'cadence and the entry benchmark pace, NOT a target to fill: when you finish the mile, tap Finish '
       'workout and your real time is recorded. Benchmarks: ~15 min fast walk, 11-13 min jogging, '
       '9-11 min very good, under 9 min very very good.'));
END $$;
