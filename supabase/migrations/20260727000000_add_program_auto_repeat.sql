-- Auto-repeat: let a program loop back to its first session instead of ending.
--
-- Programs are otherwise linear and finite -- once every session is satisfied the
-- enrollment flips to 'completed' (see complete_program_session). That is wrong
-- for "repeating workouts" (Simple & Sinister, the Onnit beginner circuit): the
-- same session done over and over, where progress is added load, not advancing
-- through sessions. This adds a per-enrollment toggle -- available on ANY program,
-- not a special program kind -- plus a template default the seeds set.
--
--   programs.default_auto_repeat   the template's default; the two repeating-workout
--                                  seeds set it true, every existing program stays false.
--   user_programs.auto_repeat      the toggle the user actually controls; initialized
--                                  from the template default at enroll (enroll_in_program),
--                                  flippable anytime via useSetProgramAutoRepeat.
--   user_programs.cycles_completed bumped each time the program loops, so the UI can show
--                                  "Cycle N" and a count survives the completions reset
--                                  that a loop performs.
--
-- Behavior lives in the two RPC migrations that follow; this is columns only.

ALTER TABLE programs
  ADD COLUMN default_auto_repeat BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE user_programs
  ADD COLUMN auto_repeat BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE user_programs
  ADD COLUMN cycles_completed INTEGER NOT NULL DEFAULT 0;
