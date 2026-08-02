-- Seed the A+A Protocol Plan A stage ladder: C+J -> C+J+C -> C+J+C+J ->
-- C+J+C+J+C -> C+J+C+J+C+J (up to three cleans + three jerks every 30s).
--
-- The refit migration (20260724000005) shipped only the first stage as encoded
-- sessions and left the escalation as prose; set_program_stage now makes it a
-- real mechanism. Each stage authors title, movements (name + repScheme [1] —
-- single-element repScheme keeps the complex runtime's one-tap-per-round
-- behavior), and work/deload notes; weights are never authored here.
--
-- Backfills existing clones too: safe exception to the never-refit-clones
-- rule, because it only fills the new nullable `stages` column — sessions are
-- untouched, and current_stage_index defaults to 0 (everyone is on C+J).
--
-- pg_temp helpers are prefixed aa_stage_ to avoid colliding with the other
-- aa_* helpers earlier migrations define in CI's single-session apply.

-- One decomposed lift in the complex: name + one rep, no weights.
CREATE OR REPLACE FUNCTION pg_temp.aa_stage_mv(p_name TEXT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'movementName', p_name,
    'repScheme', to_jsonb(ARRAY[1]::INT[]));
$$;

-- A complex of p_cleans cleans and p_jerks jerks, alternating C,J,C,J,...
-- with any surplus clean appended at the end (the source escalates by adding
-- a clean first, then a jerk).
CREATE OR REPLACE FUNCTION pg_temp.aa_stage_complex(p_cleans INT, p_jerks INT)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_agg(mv ORDER BY ord)
  FROM (
    SELECT pg_temp.aa_stage_mv('One-Arm Kettlebell Clean') AS mv, i * 2 AS ord
    FROM generate_series(1, p_cleans) AS i
    UNION ALL
    SELECT pg_temp.aa_stage_mv('One-Arm Kettlebell Jerk'), i * 2 + 1
    FROM generate_series(1, p_jerks) AS i
  ) parts;
$$;

-- Work-session note for a stage: the autoregulation rule plus the progression
-- tail (what to add once 30 min is owned).
CREATE OR REPLACE FUNCTION pg_temp.aa_stage_work_note(p_complex TEXT, p_tail TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT p_complex || ' - one bell, one set every 30s, alternating hands: '
    'left on the minute, right 30s later. Carry on until you cannot pass the '
    'talk test right before the next set; stop then, or at 30 min, whichever '
    'comes first. ' || p_tail;
$$;

-- Deload note for a stage: same complex, one bell size lighter.
CREATE OR REPLACE FUNCTION pg_temp.aa_stage_deload_note(p_complex TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT 'Deload week - one kettlebell size lighter (-8 kg gentlemen, -4 kg '
    'ladies), same ' || p_complex || ' complex and same 30s left/right '
    'cadence. Duration stays autoregulated: carry on until the talk test '
    'fails, up to 30 min. Explode, and keep it easy.';
$$;

CREATE OR REPLACE FUNCTION pg_temp.aa_stage(
  p_title TEXT, p_cleans INT, p_jerks INT, p_tail TEXT
)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'title', p_title,
    'movements', pg_temp.aa_stage_complex(p_cleans, p_jerks),
    'preWorkoutNotes', pg_temp.aa_stage_work_note(p_title, p_tail),
    'deloadPreWorkoutNotes', pg_temp.aa_stage_deload_note(p_title));
$$;

DO $$
DECLARE
  v_template UUID;
  v_stages   JSONB;
  v_clones   INT;
BEGIN
  SELECT id INTO v_template
  FROM programs
  WHERE slug = 'aa-protocol-plan-a' AND owner_id IS NULL;

  IF v_template IS NULL THEN
    RAISE NOTICE 'A+A Protocol template not found; no stages seeded.';
    RETURN;
  END IF;

  v_stages := jsonb_build_array(
    pg_temp.aa_stage('C+J', 1, 1,
      'Once 30 min is repeatable with a clean talk test, advance the stage: '
      'add a second clean to each set (C+J+C).'),
    pg_temp.aa_stage('C+J+C', 2, 1,
      'Once 30 min is repeatable with a clean talk test, advance the stage: '
      'add a second jerk to each set (C+J+C+J).'),
    pg_temp.aa_stage('C+J+C+J', 2, 2,
      'Once 30 min is repeatable with a clean talk test, advance the stage: '
      'add a third clean to each set (C+J+C+J+C).'),
    pg_temp.aa_stage('C+J+C+J+C', 3, 2,
      'Once 30 min is repeatable with a clean talk test, advance the stage: '
      'add a third jerk to each set (C+J+C+J+C+J).'),
    pg_temp.aa_stage('C+J+C+J+C+J', 3, 3,
      'This is the final stage - three clean & jerks every 30 seconds. Once '
      '30 min is repeatable with a clean talk test, you own the protocol: '
      'move up a bell size and restart at C+J.'));

  UPDATE programs SET stages = v_stages WHERE id = v_template;

  -- Existing enrollees' clones get the ladder too (sessions untouched).
  UPDATE programs c
  SET stages = v_stages
  WHERE c.source_program_id = v_template
    AND c.stages IS NULL;
  GET DIAGNOSTICS v_clones = ROW_COUNT;

  RAISE NOTICE 'A+A stages seeded on template and % clone(s).', v_clones;
END $$;
