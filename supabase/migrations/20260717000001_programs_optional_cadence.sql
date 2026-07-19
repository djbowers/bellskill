-- PROD-237: program creation no longer asks for weeks / days-per-week.
--
-- Both are now derived from the program's own sessions rather than declared up
-- front, so a freshly-created user program has no cadence yet. Drop the NOT NULL
-- constraints so `useCreateProgram` can insert a program with these unset; they
-- read as NULL until sessions exist.
--
-- Downstream already tolerates the unset state:
--   * reorder_program_sessions / delete_program_session relabel week/day with
--     GREATEST(COALESCE(days_per_week, 1), 1) — a NULL cadence means one session
--     per week, matching the builder's own `daysPerWeek || 1` fallback.
--   * useProgramProgress derives its week count from the sessions themselves.
--   * usePrograms derives the "X weeks · Y/week" summary from each program's
--     session layout (max week_number / max day_number).
--
-- Seeded shared programs keep supplying explicit values, so their authored
-- cadence is unchanged.

ALTER TABLE programs ALTER COLUMN num_weeks DROP NOT NULL;
ALTER TABLE programs ALTER COLUMN days_per_week DROP NOT NULL;
