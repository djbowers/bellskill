-- Program Tracking Slice 1 (schema + RLS + copy-on-enroll).
--
-- Four tables that add a sequencing + progress layer over the existing
-- workout_logs pipeline:
--   programs                     reusable definition (shared DFW or user-authored)
--   program_sessions             ordered sessions, each a WorkoutOptions JSONB blob
--   user_programs                a user's enrollment (0-or-1 active per user)
--   program_session_completions  progress; points a session at the real workout_logs row
--
-- The shared/public DFW program (owner_id NULL, is_public true) is seeded by the
-- companion migration 20260706170001_seed_dry_fighting_weight.sql. Enrolling in a
-- shared program clones it into a user-owned editable copy via enroll_in_program().
--
-- House style (matches user_movements / session_recommendations):
--   * one RLS policy per verb, predicate (SELECT auth.uid()) = <owner col>
--   * explicit REVOKE ALL ... / GRANT ... TO authenticated
--   * ownership column on programs/program_sessions is owner_id (NOT user_id).

-- ── programs ─────────────────────────────────────────────────────────────────
CREATE TABLE programs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = system/shared
  source_program_id UUID REFERENCES programs(id) ON DELETE SET NULL,  -- set on copy-on-enroll clones
  slug              TEXT UNIQUE,                                       -- e.g. 'dry-fighting-weight' (system only)
  title             TEXT NOT NULL,
  description       TEXT,
  author_name       TEXT,
  num_weeks         SMALLINT NOT NULL,
  days_per_week     SMALLINT NOT NULL,
  is_public         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_programs_owner ON programs(owner_id);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

-- Read: any public program OR your own. (owner_id, not user_id, is the owner col.)
CREATE POLICY "Users can view public or own programs" ON programs
  FOR SELECT USING (is_public OR (SELECT auth.uid()) = owner_id);

CREATE POLICY "Users can insert own programs" ON programs
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Users can update own programs" ON programs
  FOR UPDATE USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY "Users can delete own programs" ON programs
  FOR DELETE USING ((SELECT auth.uid()) = owner_id);

REVOKE ALL ON TABLE public.programs FROM anon;
REVOKE ALL ON TABLE public.programs FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.programs TO authenticated;

-- ── program_sessions ─────────────────────────────────────────────────────────
CREATE TABLE program_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  sequence_index  SMALLINT NOT NULL,      -- 0..N-1: canonical "next" order
  week_number     SMALLINT NOT NULL,      -- 1-based, for labels/progress
  day_number      SMALLINT NOT NULL,      -- 1-based within the week
  title           TEXT NOT NULL,          -- "Ladders 1-2-3"
  workout_options JSONB NOT NULL,         -- EXACTLY Omit<WorkoutOptions,'startedAt'>
  notes           TEXT,
  UNIQUE (program_id, sequence_index)
);

CREATE INDEX idx_program_sessions_program ON program_sessions(program_id, sequence_index);

ALTER TABLE program_sessions ENABLE ROW LEVEL SECURITY;

-- You can read a session iff you can read its parent program.
CREATE POLICY "Users can view sessions of readable programs" ON program_sessions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM programs p
    WHERE p.id = program_sessions.program_id
      AND (p.is_public OR (SELECT auth.uid()) = p.owner_id)));

-- You can write sessions only of programs you own.
CREATE POLICY "Users can insert sessions of own programs" ON program_sessions
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM programs p
    WHERE p.id = program_sessions.program_id AND (SELECT auth.uid()) = p.owner_id));

CREATE POLICY "Users can update sessions of own programs" ON program_sessions
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM programs p
    WHERE p.id = program_sessions.program_id AND (SELECT auth.uid()) = p.owner_id));

CREATE POLICY "Users can delete sessions of own programs" ON program_sessions
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM programs p
    WHERE p.id = program_sessions.program_id AND (SELECT auth.uid()) = p.owner_id));

REVOKE ALL ON TABLE public.program_sessions FROM anon;
REVOKE ALL ON TABLE public.program_sessions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.program_sessions TO authenticated;

-- ── user_programs ────────────────────────────────────────────────────────────
CREATE TABLE user_programs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id   UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'completed', 'abandoned', 'paused')),
  config       JSONB NOT NULL DEFAULT '{}',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ZERO-OR-ONE ACTIVE PROGRAM PER USER, enforced at the schema level.
CREATE UNIQUE INDEX one_active_program_per_user
  ON user_programs(user_id) WHERE status = 'active';

ALTER TABLE user_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own user_programs" ON user_programs
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own user_programs" ON user_programs
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own user_programs" ON user_programs
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own user_programs" ON user_programs
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.user_programs FROM anon;
REVOKE ALL ON TABLE public.user_programs FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_programs TO authenticated;

-- ── program_session_completions ──────────────────────────────────────────────
CREATE TABLE program_session_completions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_program_id    UUID NOT NULL REFERENCES user_programs(id) ON DELETE CASCADE,
  program_session_id UUID NOT NULL REFERENCES program_sessions(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_log_id     BIGINT REFERENCES workout_logs(id) ON DELETE SET NULL, -- NULL if skipped
  status             TEXT NOT NULL DEFAULT 'completed'
                     CHECK (status IN ('completed', 'skipped')),
  completed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_program_id, program_session_id)  -- a session satisfied at most once per enrollment
);

CREATE INDEX idx_psc_user_program ON program_session_completions(user_program_id);

ALTER TABLE program_session_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own program_session_completions" ON program_session_completions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own program_session_completions" ON program_session_completions
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own program_session_completions" ON program_session_completions
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own program_session_completions" ON program_session_completions
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.program_session_completions FROM anon;
REVOKE ALL ON TABLE public.program_session_completions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.program_session_completions TO authenticated;

-- ── enroll_in_program(): copy-on-enroll + activate, atomically ────────────────
-- Enrolling in a program:
--   * If the program is already yours, no clone -- activate it directly.
--   * If it is shared/public (e.g. seeded DFW), clone programs + program_sessions
--     into a user-owned editable copy (source_program_id = original) so mid-program
--     edits never mutate the shared template.
-- Any currently-active enrollment is abandoned first, so the partial unique index
-- one_active_program_per_user is never violated. Whole thing is one transaction.
--
-- SECURITY INVOKER (house default, cf. pattern_debt_window): the caller already
-- has RLS permission for every step -- read a public/own program, insert a program
-- they own, insert/update their own user_programs -- so no privilege escalation is
-- needed. Returns the new user_programs.id.
CREATE OR REPLACE FUNCTION public.enroll_in_program(p_program_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id          UUID := auth.uid();
  v_owner_id         UUID;
  v_is_public        BOOLEAN;
  v_target_program   UUID;
  v_user_program_id  UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- RLS on this SELECT already restricts to public-or-own; a NOT FOUND result
  -- means the program does not exist or is not visible to the caller.
  SELECT owner_id, is_public INTO v_owner_id, v_is_public
  FROM programs WHERE id = p_program_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program % not found or not accessible', p_program_id;
  END IF;

  -- Abandon any existing active enrollment (keeps the partial unique index happy).
  UPDATE user_programs
    SET status = 'abandoned'
    WHERE user_id = v_user_id AND status = 'active';

  IF v_owner_id = v_user_id THEN
    v_target_program := p_program_id;                     -- own program: no clone
  ELSE
    INSERT INTO programs
      (owner_id, source_program_id, slug, title, description, author_name,
       num_weeks, days_per_week, is_public)
    SELECT v_user_id, id, NULL, title, description, author_name,
           num_weeks, days_per_week, false
    FROM programs WHERE id = p_program_id
    RETURNING id INTO v_target_program;

    INSERT INTO program_sessions
      (program_id, sequence_index, week_number, day_number, title, workout_options, notes)
    SELECT v_target_program, sequence_index, week_number, day_number, title, workout_options, notes
    FROM program_sessions WHERE program_id = p_program_id
    ORDER BY sequence_index;
  END IF;

  INSERT INTO user_programs (user_id, program_id, status)
  VALUES (v_user_id, v_target_program, 'active')
  RETURNING id INTO v_user_program_id;

  RETURN v_user_program_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_in_program(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.enroll_in_program(UUID) TO authenticated;
