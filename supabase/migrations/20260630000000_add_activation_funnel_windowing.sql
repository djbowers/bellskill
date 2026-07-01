-- Activation funnel windowing (PROD-170): cohort-scoped baseline reads.
--
-- `activation_funnel_summary` is an all-time aggregate over every signup, so it
-- cannot isolate the *clean* pre-intervention baseline. The curated first-workout
-- and repeat-previous surfaces were live and unflagged until PROD-174 turned them
-- OFF at 2026-06-29 17:51 UTC, so every signup before that timestamp is treatment-
-- contaminated. To read a clean baseline (and later the post-intervention lift) we
-- need to aggregate over an arbitrary signup-date window.
--
-- `activation_funnel_window(p_signup_from, p_signup_to)` returns the same metrics
-- as activation_funnel_summary, restricted to users whose signup_at falls in
-- [p_signup_from, p_signup_to). NULL bounds are unbounded, so passing both NULL
-- reproduces activation_funnel_summary exactly.
--
-- Clean baseline read:
--   SELECT * FROM activation_funnel_window('2026-06-29 17:51:53+00', NULL);
-- Fully-matured read (every metric trustworthy, see cohort maturity below):
--   SELECT * FROM activation_funnel_window('2026-06-29 17:51:53+00', now() - interval '14 days');
--
-- Cohort maturity: the north-star metric (3+ workouts within 14 days of signup)
-- is only meaningful once a user's 14-day window has fully elapsed — a 3-day-old
-- signup that will go on to activate still reads as not-activated today. So the
-- north-star count/rate here are computed ONLY over the matured subset (signup_at
-- <= now() - 14 days); `mature_signups` exposes that denominator. The first-workout
-- and 24h metrics mature within a day and are reported over the whole in-window
-- cohort. For an apples-to-apples before/after comparison, cap p_signup_to at
-- now() - interval '14 days' so the entire cohort is mature for every metric.

CREATE OR REPLACE FUNCTION public.activation_funnel_window(
  p_signup_from timestamptz DEFAULT NULL,
  p_signup_to   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  signup_from timestamptz,
  signup_to timestamptz,
  total_signups bigint,
  mature_signups bigint,
  users_with_first_workout bigint,
  signup_to_first_workout_rate numeric,
  activated_24h_count bigint,
  activated_24h_rate numeric,
  -- North-star metrics are over the matured subset (denominator = mature_signups).
  activated_north_star_count bigint,
  activated_north_star_rate numeric,
  avg_seconds_to_first_workout bigint,
  median_seconds_to_first_workout bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    p_signup_from,
    p_signup_to,
    COUNT(*),
    COUNT(*) FILTER (WHERE ua.signup_at <= now() - INTERVAL '14 days'),
    COUNT(ua.first_workout_at),
    ROUND(
      COUNT(ua.first_workout_at)::numeric / NULLIF(COUNT(*), 0), 4
    ),
    COUNT(*) FILTER (WHERE ua.activated_24h),
    ROUND(
      COUNT(*) FILTER (WHERE ua.activated_24h)::numeric / NULLIF(COUNT(*), 0), 4
    ),
    COUNT(*) FILTER (
      WHERE ua.activated_north_star
        AND ua.signup_at <= now() - INTERVAL '14 days'
    ),
    ROUND(
      COUNT(*) FILTER (
        WHERE ua.activated_north_star
          AND ua.signup_at <= now() - INTERVAL '14 days'
      )::numeric
      / NULLIF(COUNT(*) FILTER (WHERE ua.signup_at <= now() - INTERVAL '14 days'), 0),
      4
    ),
    ROUND(AVG(ua.seconds_to_first_workout))::bigint,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
      ORDER BY ua.seconds_to_first_workout
    )::bigint
  FROM public.user_activation ua
  WHERE (p_signup_from IS NULL OR ua.signup_at >= p_signup_from)
    AND (p_signup_to   IS NULL OR ua.signup_at <  p_signup_to);
$$;

-- Analyst-only, exactly like user_activation / activation_funnel_summary: this
-- aggregates across all users, so it is queried with the service role (Supabase
-- SQL editor / dashboard) and must never be exposed to anon/authenticated.
REVOKE ALL ON FUNCTION public.activation_funnel_window(timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.activation_funnel_window(timestamptz, timestamptz) TO service_role;
