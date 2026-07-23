-- Name each program's weight groups so the enrollment picker can label them.
--
-- enroll_in_program clones every session at the enrollee's chosen weight,
-- shifted by that session's authored offset from the program's modal
-- placeholder (20260723000000_enroll_in_program_relative_weights.sql). A
-- program therefore has one or more WEIGHT GROUPS -- the distinct authored
-- (weightOne, weightTwo) pairs across its sessions -- and the picker now
-- exposes a control per group instead of only the modal one.
--
-- A group derived from data alone can only be described by its relation to the
-- working weight ("8 kg lighter, weeks 4 and 8"), which never says the word the
-- athlete actually thinks in: deload, test day, heavy day. This column carries
-- that word, authored alongside the seed. It is nullable and purely
-- presentational -- the picker falls back to the derived description for
-- user-authored programs, which have no way to set it yet.
--
-- Table-level RLS policies already cover the new column, and PostgREST's `*`
-- select picks it up, so nothing else changes.
ALTER TABLE program_sessions ADD COLUMN IF NOT EXISTS weight_label TEXT;

COMMENT ON COLUMN program_sessions.weight_label IS
  'Human label for this session''s weight group ("Deload weeks", "Test day"). '
  'Every session sharing an authored weight pair carries the same label. '
  'NULL means the enrollment picker derives a description instead.';

-- Backfill the seeded shared programs. Each UPDATE selects by the session's
-- AUTHORED first-movement weight -- the same key the client groups on -- rather
-- than by sequence_index, which would rot the next time a program is reshaped.
-- Scoped to owner_id IS NULL so copy-on-enroll clones are never touched, and
-- idempotent: a re-run rewrites the same labels onto the same rows.
DO $$
DECLARE
  v_labelled INT;
  v_total    INT := 0;
  r          RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      ('aa-protocol-plan-a',           16, 'Deload weeks'),
      ('dry-fighting-weight',          28, 'Test day'),
      ('strongfirst-snatch-test-plan', 20, 'Light days'),
      ('strongfirst-snatch-test-plan', 24, 'Medium days'),
      ('strongfirst-snatch-test-plan', 28, 'Heavy days')
    ) AS t(slug, weight, label)
  LOOP
    UPDATE program_sessions ps
    SET weight_label = r.label
    FROM programs p
    WHERE p.id = ps.program_id
      AND p.owner_id IS NULL
      AND p.slug = r.slug
      AND (ps.workout_options->'movements'->0->>'weightOneValue')::NUMERIC = r.weight;
    GET DIAGNOSTICS v_labelled = ROW_COUNT;
    v_total := v_total + v_labelled;
    RAISE NOTICE 'weight_label "%" -> % session(s) of %', r.label, v_labelled, r.slug;
  END LOOP;

  RAISE NOTICE 'weight_label backfill: % sessions labelled.', v_total;
END $$;
