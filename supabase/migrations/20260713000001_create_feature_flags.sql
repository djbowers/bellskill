-- Runtime feature flags + per-user assignment (PROD-175).
--
-- Replaces the build-time VITE_FEATURE_* env vars for experiment flags with a
-- Supabase-backed mechanism so variants can be assigned per user, stay sticky
-- across sessions, and be toggled at runtime WITHOUT a redeploy. This is step 0b
-- of the activation experiment (blocks PROD-171's launchpad + curated-first-
-- workout A/B).
--
-- Two tables:
--   feature_flags             flag definitions (enabled / rollout / default
--                             variant). Toggled at runtime by the service role
--                             (Studio / SQL); clients read but never write.
--   feature_flag_assignments  sticky per-user variant, written ONLY by the
--                             SECURITY DEFINER RPC below — never by clients — so
--                             a user cannot forge themselves into a bucket.
--
-- Assignment is server-authoritative and persisted: on first eval of an enabled
-- flag the RPC buckets the user deterministically (hash of user_id+flag_key vs
-- rollout_percentage) and writes the assignment row; every later eval reads that
-- row back. Progress can't drift or be tampered client-side.

-- ── feature_flags: runtime-toggleable definitions ────────────────────────────

CREATE TABLE public.feature_flags (
  key                text PRIMARY KEY,
  description        text,
  -- Master switch. While false every caller resolves to default_variant
  -- (control) and NO assignment is written, so re-enabling re-buckets fresh.
  enabled           boolean NOT NULL DEFAULT false,
  -- Percentage of users assigned to 'treatment' when enabled (0..100). 0 = a
  -- pure runtime kill-switch that's off for everyone; 100 = on for everyone.
  rollout_percentage int NOT NULL DEFAULT 0
    CHECK (rollout_percentage BETWEEN 0 AND 100),
  -- Variant returned when the flag is disabled or a user falls outside rollout.
  default_variant   text NOT NULL DEFAULT 'control',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Flag definitions are readable by any authenticated user (transparency); they
-- are never client-writable. Runtime toggles happen via the service role
-- (Supabase Studio / SQL), which bypasses RLS.
CREATE POLICY "Users can read feature flag definitions" ON public.feature_flags
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

REVOKE ALL ON TABLE public.feature_flags FROM anon;
REVOKE ALL ON TABLE public.feature_flags FROM authenticated;
GRANT SELECT ON TABLE public.feature_flags TO authenticated;

-- ── feature_flag_assignments: sticky per-user variant ────────────────────────

CREATE TABLE public.feature_flag_assignments (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_key    text NOT NULL REFERENCES public.feature_flags(key) ON DELETE CASCADE,
  variant     text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, flag_key)
);

ALTER TABLE public.feature_flag_assignments ENABLE ROW LEVEL SECURITY;

-- Read-own only. There is intentionally NO client INSERT/UPDATE/DELETE policy:
-- assignments are written solely by evaluate_feature_flags (SECURITY DEFINER),
-- so a user can read which bucket they're in but can never forge or move it.
CREATE POLICY "Users can read own feature flag assignments"
  ON public.feature_flag_assignments
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.feature_flag_assignments FROM anon;
REVOKE ALL ON TABLE public.feature_flag_assignments FROM authenticated;
GRANT SELECT ON TABLE public.feature_flag_assignments TO authenticated;

-- ── evaluate_feature_flag: server-authoritative assign-and-return (one flag) ──
--
-- Resolves a single flag to a variant for the calling user, assigning (and
-- persisting) on the first eval of an enabled flag. SECURITY DEFINER so it can
-- bypass RLS to write the assignment row the caller isn't allowed to write
-- directly — the crux of tamper-resistance. Returns a scalar (no OUT columns
-- that would collide with the table columns in the INSERT below).
--
-- Unknown flags and the unauthenticated case resolve to the safe default
-- ('control'), never an error, so the client's fallback is only needed for
-- transport/network failures.
CREATE OR REPLACE FUNCTION public.evaluate_feature_flag(p_flag_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_enabled  boolean;
  v_rollout  int;
  v_default  text;
  v_variant  text;
  v_bucket   int;
BEGIN
  SELECT ff.enabled, ff.rollout_percentage, ff.default_variant
    INTO v_enabled, v_rollout, v_default
    FROM public.feature_flags ff
    WHERE ff.key = p_flag_key;

  -- Unknown flag → safe default.
  IF NOT FOUND THEN
    RETURN 'control';
  END IF;

  -- Unauthenticated, or flag disabled → default variant (control), and
  -- deliberately NO assignment row. Leaving disabled flags unassigned means
  -- enabling one later buckets the user fresh at that moment.
  IF v_user_id IS NULL OR NOT v_enabled THEN
    RETURN v_default;
  END IF;

  -- Enabled: sticky read. Once assigned, the stored variant wins forever (even
  -- if rollout_percentage later changes) — the experiment can't drift.
  SELECT a.variant INTO v_variant
    FROM public.feature_flag_assignments a
    WHERE a.user_id = v_user_id AND a.flag_key = p_flag_key;

  IF FOUND THEN
    RETURN v_variant;
  END IF;

  -- First eval: deterministic bucket in [0,100). hashtextextended is stable
  -- across sessions/backends; mask the sign bit before the modulo so the bucket
  -- is always non-negative.
  v_bucket := (hashtextextended(v_user_id::text || ':' || p_flag_key, 0)
               & 9223372036854775807) % 100;
  IF v_bucket < v_rollout THEN
    v_variant := 'treatment';
  ELSE
    v_variant := v_default;
  END IF;

  -- Persist. ON CONFLICT DO NOTHING + re-read makes concurrent first-evals
  -- race-safe: whichever insert wins, both callers return the stored value.
  INSERT INTO public.feature_flag_assignments (user_id, flag_key, variant)
    VALUES (v_user_id, p_flag_key, v_variant)
    ON CONFLICT (user_id, flag_key) DO NOTHING;

  SELECT a.variant INTO v_variant
    FROM public.feature_flag_assignments a
    WHERE a.user_id = v_user_id AND a.flag_key = p_flag_key;

  RETURN v_variant;
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_feature_flag(text) FROM public;
GRANT EXECUTE ON FUNCTION public.evaluate_feature_flag(text) TO authenticated;

-- ── evaluate_feature_flags: batch wrapper (one round trip for the eval client) ─
--
-- Returns one (flag_key, variant) row per requested key by delegating each to
-- evaluate_feature_flag. Thin SQL wrapper — no table DML here, so the OUT
-- column names never collide with anything.
CREATE OR REPLACE FUNCTION public.evaluate_feature_flags(p_flag_keys text[])
RETURNS TABLE (flag_key text, variant text)
LANGUAGE sql
SET search_path = public
AS $$
  SELECT k.key, public.evaluate_feature_flag(k.key)
  FROM unnest(p_flag_keys) AS k(key);
$$;

REVOKE ALL ON FUNCTION public.evaluate_feature_flags(text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.evaluate_feature_flags(text[]) TO authenticated;

-- ── Seed the migrated flags, all OFF (production behavior unchanged) ──────────
--
-- These are the flags PROD-174 introduced (curated_first_workout, repeat_
-- previous) plus the pre-existing AI next-session recommender. Production had
-- them defaulted OFF (pure-builder baseline); seeding enabled=false preserves
-- that exactly until someone deliberately toggles a row. VITE_FEATURE_PREMIUM
-- is the paywall flag and is intentionally NOT part of this mechanism.
INSERT INTO public.feature_flags (key, description) VALUES
  ('curated_first_workout', 'Curated first-workout discovery surface (PROD-174).'),
  ('repeat_previous',       'Repeat-previous-workout discovery surface (PROD-174).'),
  ('recommender',           'AI next-session recommender surface (PROD-86).');
