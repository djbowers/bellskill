-- Seed the shared "Strong Endurance Plan 025" program (Pavel Tsatsouline,
-- StrongFirst): swing or snatch A+A, sets on the minute, autoregulated volume.
-- Public + system-owned (owner_id NULL, is_public true); enrolling clones it
-- into an editable copy (enroll_in_program). Idempotent on slug. MIGRATION
-- (not seed.sql) so it reaches staging/production.
--
-- Source (free official PDF):
-- https://www.strongfirst.com/wordpress/wp-content/uploads/2024/02/Strong-Endurance-plan-025.pdf
-- Swing or snatch, sets of 5 on the minute alternating arms, 3x/week with
-- varying volume: Friday high (start day), Monday medium (80% of the last high
-- day's sets), Wednesday low (60%). Volume is AUTOREGULATED, not prescribed:
-- carry on until the talk test fails (~50s into the rest minute you cannot
-- speak several short sentences) or any StrongFirst Stop Sign appears (power
-- drop, technique change, lengthening pauses between reps) -- then stop and
-- note the set count. Progression: once a high day reaches 50 sets, add one
-- rep to all sets the next Friday. Terminal target: sets of 10 OTM (500 reps
-- in 50 min), then graduate to another Strong Endurance protocol. Goals per
-- the source: fat loss + aerobic base, NOT strength (reflected in the
-- description so it is not mis-recommended against a strength goal).
--
-- MODELING DECISIONS (PROD-243; follows the A+A Plan A precedent in
-- 20260724000005_refit_aa_protocol_plan_a_autoregulated.sql):
--
--   * AUTOREGULATED VOLUME AS A MINUTES CEILING. The app needs workoutGoal > 0
--     to start and has no "no target" unit, so each session carries a minutes
--     ceiling sized to its day's share of the TERMINAL 50-set high day:
--     high 50 min, medium 40 (80%), low 30 (60%). The countdown auto-finishing
--     is the "whichever comes first" backstop; the preWorkoutNotes state the
--     real governor (talk test / Stop Signs on the high day, last-Friday
--     percentages on medium/low days). This is option (a)+(c)-in-notes from
--     the issue: the high-day set count lives in the athlete's log, and the
--     notes tell them how to derive Monday/Wednesday from it -- no
--     per-enrollment mutable state required.
--
--   * OTM VIA intervalTimer 60 + ONE-HANDED LOADING. One movement, repScheme
--     [5], weightTwoValue 0 ('1h' mode): each interval fire runs the set on
--     one arm and the runtime mirrors sides, so arms alternate minute by
--     minute -- exactly the source's cadence. restTimer 0; the interval IS the
--     rest.
--
--   * ONE-ARM SWING IS THE SEEDED DEFAULT. The source offers swing OR snatch,
--     one-arm or two-arm -- a real branch, not ours. There is no enrollment
--     movement picker (that is PROD-232 territory), but enrolling clones an
--     editable copy, so the description and notes tell the athlete to swap the
--     movement to One-Arm Kettlebell Snatch or Kettlebell Swing (two-arm)
--     after enrolling. One-arm swing is the default because it is the lowest
--     barrier of the three (snatch is catalog-Expert).
--
--   * PROGRESSION IS USER-TRIGGERED, NOT CALENDAR-DRIVEN. "+1 rep once a high
--     day hits 50 sets" is a milestone the athlete owns: they edit the rep
--     scheme (5 -> 6 -> ... -> 10) on their cloned copy. Stated in the
--     description and the high-day notes rather than encoded as sessions.
--
--   * A ONE-WEEK REPEATING BLOCK. Three sessions (High / Medium / Low, in the
--     source's Friday-start order) with default_auto_repeat = true: the plan
--     has no fixed length ("stay on the program until sets of 10"), so
--     finishing the week loops rather than completing. num_weeks 1 /
--     days_per_week 3 keep the real weekly cadence visible, unlike the
--     cadence-less S&S.
--
--   * 24 kg is a PLACEHOLDER, as in every seed. The source's bell test (100
--     perfect reps in 5 min, sets of 10 every 30s, ~50% effort) is in the
--     description; single-bell, so the enrollment weight picker pre-fills one
--     weight (PROD-232).

-- Full workout_options for one session. Shape MUST match
-- Omit<WorkoutOptions,'startedAt'> exactly (camelCase keys): one one-handed
-- movement, sets of 5 OTM, minutes ceiling per day.
CREATE OR REPLACE FUNCTION pg_temp.se025_options(p_minutes INT, p_details TEXT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'complexSet', false,
    'intervalTimer', 60,
    'restTimer', 0,
    'workoutGoal', p_minutes,
    'workoutGoalUnits', 'minutes',
    'title', NULL,
    'preWorkoutNotes', p_details,
    'sharedWeightOneUnit', NULL,
    'sharedWeightOneValue', NULL,
    'sharedWeightTwoUnit', NULL,
    'sharedWeightTwoValue', NULL,
    'movements', jsonb_build_array(
      jsonb_build_object(
        'movementName', 'One-Arm Kettlebell Swing',
        'repScheme', to_jsonb(ARRAY[5]::INT[]),
        'weightOneUnit', 'kilograms', 'weightOneValue', 24,
        'weightTwoUnit', NULL, 'weightTwoValue', 0)
    ));
$$;

DO $$
DECLARE
  v_program_id UUID;
BEGIN
  INSERT INTO programs (owner_id, slug, title, description, author_name,
                        num_weeks, days_per_week, is_public, default_auto_repeat)
  VALUES (NULL, 'strong-endurance-plan-025',
          'Strong Endurance Plan 025',
          'Swing or snatch A+A: sets of 5 on the minute, alternating arms, three '
          'days a week at varying volume -- Friday high, Monday medium (80% of '
          'Friday''s sets), Wednesday low (60%). Volume is autoregulated, not '
          'prescribed: stop the moment you fail the talk test or hit any '
          'StrongFirst Stop Sign (power drops, technique changes, pauses between '
          'reps lengthen). Once a high day reaches 50 sets, add one rep to every '
          'set; graduate at sets of 10 (500 reps in 50 min). Built for fat loss '
          'and aerobic base, not strength. Seeded with the one-arm swing -- after '
          'enrolling, swap the movement to the snatch or the two-arm swing if '
          'that is your exercise of choice. Pick a bell you can swing or snatch '
          'with perfect technique for 100 reps in 5 min (sets of 10 every 30s, '
          'about 50% effort). Repeats weekly.',
          'Pavel Tsatsouline (StrongFirst)', 1, 3, true, true)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_program_id;

  -- If the row already existed, skip re-seeding sessions.
  IF v_program_id IS NULL THEN
    RAISE NOTICE 'Strong Endurance Plan 025 already seeded; skipping sessions.';
    RETURN;
  END IF;

  -- Friday-start order per the source: High, then Medium (Mon), then Low (Wed).
  -- Each ceiling is that day's share of the terminal 50-set high day; the notes
  -- carry the real stop rule.
  INSERT INTO program_sessions
    (program_id, sequence_index, week_number, day_number, title, workout_options)
  VALUES
    (v_program_id, 0, 1, 1, 'High volume',
     pg_temp.se025_options(50,
       'High day (the source starts on Friday). Sets of 5 on the minute, '
       'alternating arms each minute; walk and shake out between sets. Volume is '
       'autoregulated: around 50s into each rest minute, do the talk test -- '
       'speak several short sentences. The first time you cannot, or your power '
       'drops, technique changes, or pauses between reps lengthen, STOP and note '
       'your set count -- it sets Monday (80%) and Wednesday (60%). Do not push '
       'past a stop sign even if you could. The 50-min ceiling is the terminal '
       'day, not a target. Once you reach 50 sets at a rep count, add one rep to '
       'all sets next Friday (edit the rep scheme); graduate at sets of 10.')),
    (v_program_id, 1, 1, 2, 'Medium volume',
     pg_temp.se025_options(40,
       'Medium day (Monday): do 80% of your last high day''s set count, then '
       'finish the workout -- e.g. 30 sets Friday means 24 today. Same sets of 5 '
       'on the minute, alternating arms. The 40-min ceiling only matters at '
       'terminal volume; your percentage is the real stop. Still respect the '
       'StrongFirst Stop Signs if one appears sooner.')),
    (v_program_id, 2, 1, 3, 'Low volume',
     pg_temp.se025_options(30,
       'Low day (Wednesday): do 60% of your last high day''s set count, then '
       'finish the workout -- e.g. 30 sets Friday means 18 today. Same sets of 5 '
       'on the minute, alternating arms. The 30-min ceiling only matters at '
       'terminal volume; your percentage is the real stop. Still respect the '
       'StrongFirst Stop Signs if one appears sooner.'));
END $$;
