-- Restructure workout text fields: give a workout a real title, and split the
-- one overloaded descriptor into pre- vs post-workout notes that match purpose.
--
--   workout_details  ->  title  +  pre_workout_notes   (the "what & why", read before starting)
--   workout_notes    ->  post_workout_notes            (how the session actually went)
--
-- Seeded programs stuffed the long session description into workout_options'
-- `workoutDetails`, which surfaced as a wall of text mid-workout and as an
-- unwieldy History title. History now COMPOSES its title ("{program} · W#D#
-- {session title}"), so this migration also strips the redundant "<Program>
-- W#D# - " prefix out of the seeded system templates' notes.
--
-- Editing the shipped seed migrations would diverge their checksums and break
-- `db push`/CI, so every legacy-data fix lives here. Fresh environments replay
-- the seeds (old shape) then this migration, converging on the same end state as
-- production.

-- ── 1. workout_logs: rename columns, add title, backfill short legacy names ──
ALTER TABLE public.workout_logs RENAME COLUMN workout_notes TO post_workout_notes;
ALTER TABLE public.workout_logs RENAME COLUMN workout_details TO pre_workout_notes;
ALTER TABLE public.workout_logs ADD COLUMN title TEXT;

-- Most legacy workout_details were short session names ("The Giant 3.0 W1D2");
-- promote those to the new title. The long program paragraphs stay as
-- pre_workout_notes (title left NULL, History falls back to the movement list).
UPDATE public.workout_logs
SET title = pre_workout_notes,
    pre_workout_notes = NULL
WHERE pre_workout_notes IS NOT NULL
  AND char_length(pre_workout_notes) <= 80;

-- ── 2. program_sessions: rename the JSONB key for every row ───────────────────
-- Applies to system templates AND already-enrolled user clones, preserving the
-- text. A null `title` key is added so each stored blob still matches
-- Omit<WorkoutOptions,'startedAt'> exactly (the History title is composed at
-- start, so it is never persisted on the session).
UPDATE public.program_sessions
SET workout_options =
      (workout_options - 'workoutDetails')
      || jsonb_build_object(
           'preWorkoutNotes', workout_options->'workoutDetails',
           'title', NULL)
WHERE workout_options ? 'workoutDetails';

-- ── 3. Audit seeded system templates: strip the redundant W#D# prefix ─────────
-- Only the shared templates (owner_id IS NULL) are cleaned; user-cloned copies
-- keep their text from the mechanical rename above. Each program prefixed its
-- notes differently, so match per slug. (The reshaped A+A "Plan A" template was
-- already authored without a prefix, so it is intentionally absent here.)
WITH prefixes(slug, pattern) AS (
  VALUES
    ('dry-fighting-weight',          '^DFW W\d+D\d+ - '),
    ('10000-swing-challenge',        '^Week \d+, Day \d+ - '),
    ('strongfirst-snatch-test-plan', '^Snatch Test W\d+D\d+ - '),
    ('armor-building-complex',       '^ABC W\d+D\d+ - '),
    ('easy-strength',                '^Easy Strength W\d+D\d+ - '),
    ('kettlebell-mile',              '^Kettlebell Mile W\d+ - ')
)
UPDATE public.program_sessions ps
SET workout_options = jsonb_set(
      ps.workout_options,
      '{preWorkoutNotes}',
      to_jsonb(regexp_replace(ps.workout_options->>'preWorkoutNotes', pr.pattern, ''))
    )
FROM public.programs p, prefixes pr
WHERE ps.program_id = p.id
  AND p.owner_id IS NULL
  AND p.slug = pr.slug
  AND ps.workout_options->>'preWorkoutNotes' ~ pr.pattern;
