-- Seed the Strong Endurance Plan 025 stage ladder: Sets of 5 -> ... -> Sets
-- of 10, one rung per rep count.
--
-- The seed (20260727000006) left the "+1 rep once a high day hits 50 sets"
-- progression as prose the athlete acted on by editing rep schemes;
-- set_program_stage (generalized for non-complex programs in 20260802000003)
-- now makes it a real mechanism. Each stage is the one seeded movement at that
-- rep count; weights stay per-movement and are never authored here.
--
-- All three weekly sessions share one repScheme per stage: Plan 025 scales its
-- days by SET COUNT (Medium = 80%, Low = 60% of the last high day's sets),
-- never by reps, so a uniform rep count is faithful to the source. Because a
-- stage authors one note stamped on every session, the note is day-agnostic:
-- it carries the high-day autoregulation rule AND the Medium/Low percentage
-- derivation, replacing the seed's per-day prose without losing its content.
-- Session titles (High/Medium/Low volume) are structural day labels the
-- generalized RPC leaves untouched. No deloadPreWorkoutNotes — 025 has no
-- deload weight group.
--
-- Backfills existing clones via source_program_id, same safe exception to the
-- never-refit-clones rule as the A+A backfill (20260802000002): only the
-- nullable `stages` column is filled, sessions are untouched, and
-- current_stage_index defaults to 0 (everyone is on sets of 5).

CREATE OR REPLACE FUNCTION pg_temp.se025_stage(p_reps INT, p_tail TEXT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'title', 'Sets of ' || p_reps,
    'movements', jsonb_build_array(jsonb_build_object(
      'movementName', 'One-Arm Kettlebell Swing',
      'repScheme', to_jsonb(ARRAY[p_reps]::INT[]))),
    'preWorkoutNotes',
      'Sets of ' || p_reps || ' on the minute, alternating arms each minute; '
      'walk and shake out between sets. High day: volume is autoregulated - '
      'around 50s into each rest minute do the talk test (speak several short '
      'sentences); the first time you cannot, or any StrongFirst Stop Sign '
      'appears (power drops, technique changes, pauses between reps lengthen), '
      'STOP and note your set count. Medium day: 80% of your last high day''s '
      'sets. Low day: 60%. ' || p_tail);
$$;

DO $$
DECLARE
  v_template UUID;
  v_stages   JSONB;
  v_clones   INT;
BEGIN
  SELECT id INTO v_template
  FROM programs
  WHERE slug = 'strong-endurance-plan-025' AND owner_id IS NULL;

  IF v_template IS NULL THEN
    RAISE NOTICE 'Strong Endurance Plan 025 template not found; no stages seeded.';
    RETURN;
  END IF;

  SELECT jsonb_agg(
           pg_temp.se025_stage(
             reps,
             CASE WHEN reps < 10 THEN
               'Once a high day reaches 50 sets at this rep count, advance the '
               'stage: one more rep per set (sets of ' || reps + 1 || '). '
               'Graduate at sets of 10.'
             ELSE
               'This is the final stage. Once a high day reaches 50 sets of 10 '
               '- 500 reps in 50 min - you have graduated Plan 025: move up to '
               'a heavier bell, or on to another Strong Endurance protocol.'
             END)
           ORDER BY reps)
  INTO v_stages
  FROM generate_series(5, 10) AS reps;

  UPDATE programs SET stages = v_stages WHERE id = v_template;

  -- Existing enrollees' clones get the ladder too (sessions untouched).
  UPDATE programs c
  SET stages = v_stages
  WHERE c.source_program_id = v_template
    AND c.stages IS NULL;
  GET DIAGNOSTICS v_clones = ROW_COUNT;

  RAISE NOTICE 'Plan 025 stages seeded on template and % clone(s).', v_clones;
END $$;
