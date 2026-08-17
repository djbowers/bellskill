-- Chalk, the AI kettlebell coach chat: conversation threads and their messages.
--
-- The chalk-chat Edge Function is the SOLE writer of chalk_messages, via the
-- service role. This is a stricter rule than it looks: every row here is replayed
-- to the model as prior conversation on the next turn, so a client-writable
-- message table is a direct injection channel into a privileged context — a user
-- could insert a role='assistant' row and have Chalk read its own forged
-- instructions back. Clients read their own rows and may delete a whole thread;
-- everything else goes through the function.

CREATE TABLE chalk_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Derived from the first user message; NULL until that message lands.
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Set explicitly by the Edge Function. There is no updated_at trigger
  -- convention in this schema, so nothing maintains this automatically.
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chalk_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES chalk_threads(id) ON DELETE CASCADE,
  -- Denormalized from the thread so the RLS predicate is a column compare
  -- rather than a join back to chalk_threads on every row read.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Total order within a thread. created_at alone can tie: the user row and the
  -- assistant row of one turn are written by the same request.
  seq BIGSERIAL NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  -- 'aborted' = reader hit Stop mid-stream; 'error' = generation failed. Both
  -- keep whatever text arrived, so a partial answer is never silently dropped.
  status TEXT NOT NULL DEFAULT 'complete'
    CHECK (status IN ('complete', 'error', 'aborted')),
  error TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  -- Snapshot of the context block fed to the model, for prompt iteration.
  -- Assistant rows only. Mirrors session_recommendations.inputs.
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chalk_threads_user_last
  ON chalk_threads(user_id, last_message_at DESC);

CREATE INDEX idx_chalk_messages_thread_seq
  ON chalk_messages(thread_id, seq);

-- Powers the per-user daily send cap the Edge Function enforces before each
-- model call. Chat is unbounded in a way the one-shot recommenders are not.
CREATE INDEX idx_chalk_messages_user_created
  ON chalk_messages(user_id, created_at DESC);

ALTER TABLE chalk_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chalk_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chalk_threads" ON chalk_threads
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- Deleting a conversation is the one client write worth granting: it cascades
-- to the thread's messages and cannot forge anything.
CREATE POLICY "Users can delete own chalk_threads" ON chalk_threads
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own chalk_messages" ON chalk_messages
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- Table privileges: RLS narrows to own rows, these bound the verbs. There is
-- intentionally no INSERT or UPDATE for authenticated on either table, and no
-- DELETE on chalk_messages — threads cascade.
REVOKE ALL ON TABLE public.chalk_threads FROM anon;
REVOKE ALL ON TABLE public.chalk_threads FROM authenticated;
REVOKE ALL ON TABLE public.chalk_messages FROM anon;
REVOKE ALL ON TABLE public.chalk_messages FROM authenticated;

GRANT SELECT, DELETE ON TABLE public.chalk_threads TO authenticated;
GRANT SELECT ON TABLE public.chalk_messages TO authenticated;
