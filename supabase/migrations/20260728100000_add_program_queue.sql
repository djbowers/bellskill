-- Program queue: line programs up to run back-to-back.
--
-- Enrollments are otherwise immediate -- enroll_in_program claims an active
-- slot right away or raises PROGRAM_SLOTS_FULL. A queued enrollment instead
-- waits its turn: the program is cloned and its weights baked at queue time
-- (same enroll math), the row sits at status 'queued' holding NO active_slot,
-- and when an active program finishes, complete_program_session promotes the
-- lowest queue_position into the freed slot.
--
--   user_programs.status 'queued'   a cloned, weight-baked enrollment waiting
--                                   for a slot; excluded from every
--                                   status='active' query and constraint.
--   user_programs.queue_position    1-based order within the user's queue.
--                                   Gaps are fine (promotion never renumbers);
--                                   ordering is all that matters.
--
-- Precedence: a queued program beats auto_repeat -- the queue is an explicit,
-- finite "do this next", while auto-repeat is a standing loop that would
-- otherwise make the queue unreachable. Behavior lives in the two RPC
-- migrations that follow; this is columns only.

ALTER TABLE user_programs
  DROP CONSTRAINT user_programs_status_check;
ALTER TABLE user_programs
  ADD CONSTRAINT user_programs_status_check
  CHECK (status IN ('active', 'completed', 'abandoned', 'paused', 'queued'));

ALTER TABLE user_programs ADD COLUMN queue_position INTEGER;

ALTER TABLE user_programs ADD CONSTRAINT user_programs_queue_position_range
  CHECK (queue_position IS NULL OR queue_position >= 1);

-- One-directional, like user_programs_active_needs_slot: every queued row needs a
-- position, but a non-queued row may keep a stale one (the index ignores it).
ALTER TABLE user_programs ADD CONSTRAINT queued_requires_position
  CHECK (status <> 'queued' OR queue_position IS NOT NULL);

CREATE UNIQUE INDEX one_program_per_queue_position
  ON user_programs(user_id, queue_position) WHERE status = 'queued';
