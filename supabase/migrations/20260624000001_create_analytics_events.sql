-- Activation funnel instrumentation (PROD-157): measurement backbone for the
-- Recommended-First-Workout project. We cannot prove an activation lift (or
-- validate the 79% drop-off claim) without funnel events flowing somewhere we
-- can query *before* the recommended-first-workout surface ships.
--
-- Analytics sink: a first-party `analytics_events` table. The app is already
-- Supabase-centric with no external analytics dependency, so a queryable table
-- keeps the funnel self-contained (no new vendor, env var, or network egress)
-- and lets us derive the two project metrics with plain SQL / the views below.

CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Funnel event name, e.g. signup_completed / first_session_started /
  -- workout_started / workout_completed. Kept as free TEXT (not an enum) so new
  -- events can ship without a migration.
  event_name TEXT NOT NULL,
  -- Event payload: is_first_workout, elapsed times, movement_count, etc.
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_user_created
  ON public.analytics_events (user_id, created_at DESC);

CREATE INDEX idx_analytics_events_name_created
  ON public.analytics_events (event_name, created_at DESC);

-- Once-per-user funnel events. signup_completed is emitted exactly-once by the
-- handle_new_user() trigger, but first_session_started is client-emitted and its
-- in-memory ref guard resets on unmount/remount, so a re-mounted new user could
-- insert a second row. This partial unique index is the right-layer backstop: a
-- duplicate insert hits a unique violation, which trackEvent() swallows
-- (fire-and-forget). Other events (workout_started/completed) are intentionally
-- repeatable and excluded.
CREATE UNIQUE INDEX idx_analytics_events_once_per_user
  ON public.analytics_events (user_id, event_name)
  WHERE event_name IN ('signup_completed', 'first_session_started');

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Clients may append their own events and read their own back. No UPDATE/DELETE
-- policy: events are immutable once written.
CREATE POLICY "Users can insert own analytics_events" ON public.analytics_events
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own analytics_events" ON public.analytics_events
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- Table privileges mirror the rest of the schema: anon gets nothing,
-- authenticated gets INSERT + SELECT (RLS narrows both to the caller's rows).
REVOKE ALL ON TABLE public.analytics_events FROM anon;
REVOKE ALL ON TABLE public.analytics_events FROM authenticated;
GRANT INSERT, SELECT ON TABLE public.analytics_events TO authenticated;

-- signup_completed is the top of the funnel and must fire exactly once per user
-- on first successful auth. The auth.users INSERT trigger is the authoritative
-- place for that (server-side, exactly-once, no client dedup), so extend the
-- existing handle_new_user() to emit it alongside the profile row.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = ''
    AS $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');

  insert into public.analytics_events (user_id, event_name, properties)
  values (new.id, 'signup_completed', '{}'::jsonb);

  return new;
end;
$$;

-- Per-user activation read. Signup time is taken from auth.users.created_at so
-- the baseline covers every existing user, not just those signed up after this
-- migration. first_workout_at / the 14-day count are derived from workout_logs
-- (the canonical record of completed workouts), which also makes is_first_workout
-- recoverable independent of the client-emitted flag.
CREATE OR REPLACE VIEW public.user_activation AS
SELECT
  u.id AS user_id,
  u.created_at AS signup_at,
  fw.first_workout_at,
  CASE
    WHEN fw.first_workout_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (fw.first_workout_at - u.created_at))::bigint
  END AS seconds_to_first_workout,
  -- Leading indicator: first workout completed within 24h of signup.
  (
    fw.first_workout_at IS NOT NULL
    AND fw.first_workout_at <= u.created_at + INTERVAL '24 hours'
  ) AS activated_24h,
  COALESCE(w14.workouts_within_14d, 0) AS workouts_within_14d,
  -- North star leading metric: 3+ workouts within 14 days of signup.
  (COALESCE(w14.workouts_within_14d, 0) >= 3) AS activated_north_star
FROM auth.users u
LEFT JOIN LATERAL (
  SELECT MIN(wl.completed_at) AS first_workout_at
  FROM public.workout_logs wl
  WHERE wl.user_id = u.id
) fw ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS workouts_within_14d
  FROM public.workout_logs wl
  WHERE wl.user_id = u.id
    AND wl.completed_at <= u.created_at + INTERVAL '14 days'
) w14 ON true;

-- Workspace-wide baseline: signup -> first-workout conversion, the two project
-- metrics, and time-to-first-workout. Query this once before launch to capture
-- the before number, then again after to read the lift (blocks PROD-162).
CREATE OR REPLACE VIEW public.activation_funnel_summary AS
SELECT
  COUNT(*) AS total_signups,
  COUNT(first_workout_at) AS users_with_first_workout,
  ROUND(
    COUNT(first_workout_at)::numeric / NULLIF(COUNT(*), 0), 4
  ) AS signup_to_first_workout_rate,
  COUNT(*) FILTER (WHERE activated_24h) AS activated_24h_count,
  ROUND(
    COUNT(*) FILTER (WHERE activated_24h)::numeric / NULLIF(COUNT(*), 0), 4
  ) AS activated_24h_rate,
  COUNT(*) FILTER (WHERE activated_north_star) AS activated_north_star_count,
  ROUND(
    COUNT(*) FILTER (WHERE activated_north_star)::numeric / NULLIF(COUNT(*), 0), 4
  ) AS activated_north_star_rate,
  ROUND(AVG(seconds_to_first_workout))::bigint AS avg_seconds_to_first_workout,
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY seconds_to_first_workout
  )::bigint AS median_seconds_to_first_workout
FROM public.user_activation;

-- These views read across all users via auth.users, so they are analyst-only:
-- queried with the service role (Supabase SQL editor / dashboard), which
-- bypasses RLS. Deliberately NOT granted to anon/authenticated so they can
-- never leak other users' activation data to the client.
REVOKE ALL ON public.user_activation FROM anon, authenticated;
REVOKE ALL ON public.activation_funnel_summary FROM anon, authenticated;
