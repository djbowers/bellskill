-- Convert the two seeded interval programs from minutes goals to rounds goals.
--
-- Both countdown timers are wall-clock-deadline based (src/hooks/
-- useCountdownTimer.ts, #198): backgrounding or locking the phone burns the
-- minutes-goal countdown while the interval timer credits at most one round on
-- return, so interval sessions auto-finish short of their prescribed rounds
-- (seen live: A+A Plan A ended at 29/30 rounds). A rounds goal counts actual
-- work and is immune; the runner already supports rounds + intervals.
--
-- Round semantics (verified against the runner):
--   * A+A Plan A: single-arm complex on a 30s interval -- one round is a
--     left+right pair = 60s, so the rounds number EQUALS the minutes number
--     (30 min -> 30 rounds). Units flip, value carries over -- which also
--     converts clones whose duration the athlete edited.
--   * SE025: one-handed movement OTM -- one round is a left+right pair =
--     2 min, so rounds = minutes / 2 (50/40/30 -> 25/20/15; 25 rounds is
--     exactly the source's terminal 50-set high day).
--
-- Forward DATA FIX over template AND enrolled clones (source_program_id, same
-- clone targeting as 20260802000002). Goal conversion is scoped to sessions
-- still on minutes with an interval timer, so it is idempotent and skips
-- athletes who already switched units themselves. Prose still saying "30 min"
-- (descriptions, session notes, stage notes -- stage notes get re-stamped onto
-- sessions by set_program_stage) is fixed by exact-phrase replace(): a no-op
-- wherever the athlete rewrote the text, so it is safe on clones too.

DO $$
DECLARE
  v_template UUID;
  v_sessions INT;
BEGIN
  SELECT id INTO v_template
  FROM programs
  WHERE slug = 'aa-protocol-plan-a' AND owner_id IS NULL;

  IF v_template IS NULL THEN
    RAISE NOTICE 'A+A Protocol template not found; nothing to convert.';
  ELSE
    -- One round = one minute, so the goal value carries over unchanged.
    UPDATE program_sessions ps
    SET workout_options = ps.workout_options
      || jsonb_build_object('workoutGoalUnits', 'rounds')
    FROM programs p
    WHERE ps.program_id = p.id
      AND (p.id = v_template OR p.source_program_id = v_template)
      AND ps.workout_options->>'workoutGoalUnits' = 'minutes'
      AND (ps.workout_options->>'intervalTimer')::INT > 0;
    GET DIAGNOSTICS v_sessions = ROW_COUNT;

    UPDATE program_sessions ps
    SET workout_options = jsonb_set(ps.workout_options, '{preWorkoutNotes}',
      to_jsonb(replace(replace(replace(
        ps.workout_options->>'preWorkoutNotes',
        'stop then, or at 30 min, whichever comes first',
        'stop then, or at 30 rounds (30 minutes of work), whichever comes first'),
        'carry on until the talk test fails, up to 30 min',
        'carry on until the talk test fails, up to 30 rounds (30 minutes of work)'),
        'Once 30 min is repeatable with a clean talk test',
        'Once all 30 rounds are repeatable with a clean talk test')))
    FROM programs p
    WHERE ps.program_id = p.id
      AND (p.id = v_template OR p.source_program_id = v_template)
      AND ps.workout_options->>'preWorkoutNotes' IS NOT NULL;

    UPDATE programs
    SET description = replace(replace(description,
          'stop then, or at 30 minutes, whichever comes first',
          'stop then, or at 30 rounds (30 minutes of work), whichever comes first'),
          'until 30 minutes of clean & jerk is repeatable',
          'until all 30 rounds of clean & jerk are repeatable'),
        stages = replace(replace(stages::TEXT,
          'stop then, or at 30 min, whichever comes first',
          'stop then, or at 30 rounds (30 minutes of work), whichever comes first'),
          'Once 30 min is repeatable with a clean talk test',
          'Once all 30 rounds are repeatable with a clean talk test')::JSONB
    WHERE (id = v_template OR source_program_id = v_template)
      AND stages IS NOT NULL;

    RAISE NOTICE 'A+A Protocol: % session(s) converted to rounds.', v_sessions;
  END IF;
END $$;

DO $$
DECLARE
  v_template UUID;
  v_sessions INT;
BEGIN
  SELECT id INTO v_template
  FROM programs
  WHERE slug = 'strong-endurance-plan-025' AND owner_id IS NULL;

  IF v_template IS NULL THEN
    RAISE NOTICE 'Plan 025 template not found; nothing to convert.';
  ELSE
    -- One round = two OTM sets = 2 minutes: 50/40/30 min -> 25/20/15 rounds.
    UPDATE program_sessions ps
    SET workout_options = ps.workout_options || jsonb_build_object(
          'workoutGoalUnits', 'rounds',
          'workoutGoal',
          GREATEST(1, (ps.workout_options->>'workoutGoal')::INT / 2))
    FROM programs p
    WHERE ps.program_id = p.id
      AND (p.id = v_template OR p.source_program_id = v_template)
      AND ps.workout_options->>'workoutGoalUnits' = 'minutes'
      AND (ps.workout_options->>'intervalTimer')::INT > 0;
    GET DIAGNOSTICS v_sessions = ROW_COUNT;

    UPDATE program_sessions ps
    SET workout_options = jsonb_set(ps.workout_options, '{preWorkoutNotes}',
      to_jsonb(replace(replace(replace(
        ps.workout_options->>'preWorkoutNotes',
        'The 50-min ceiling is the terminal day',
        'The 25-round ceiling (one round = a left+right pair of sets) is the terminal day'),
        'The 40-min ceiling only matters at terminal volume',
        'The 20-round ceiling (one round = a left+right pair of sets) only matters at terminal volume'),
        'The 30-min ceiling only matters at terminal volume',
        'The 15-round ceiling (one round = a left+right pair of sets) only matters at terminal volume')))
    FROM programs p
    WHERE ps.program_id = p.id
      AND (p.id = v_template OR p.source_program_id = v_template)
      AND ps.workout_options->>'preWorkoutNotes' IS NOT NULL;

    -- Stage notes carry no ceiling phrasing (only true statements about time),
    -- so stages stay untouched. Description gets the app-units equivalence.
    UPDATE programs
    SET description = description
      || ' In the app one round is a left+right pair of sets, so the ceilings '
         'are 25/20/15 rounds for the High/Medium/Low days.'
    WHERE id = v_template
      AND description NOT LIKE '%one round is a left+right pair%';

    RAISE NOTICE 'Plan 025: % session(s) converted to rounds.', v_sessions;
  END IF;
END $$;
