-- Variant-attributed activation funnel read (PROD-172).
--
-- activation_funnel_window slices by signup date, which is enough for a pure
-- before/after read but can't attribute a user to the flag arm they actually
-- saw. This function joins user_activation to the sticky
-- feature_flag_assignments rows for a given flag, so each row is one variant's
-- funnel — the attributable lift read PROD-172 asks for. Users who signed up
-- in-window but were never bucketed (signed up before the flag was enabled, or
-- never evaluated it) report under the 'unassigned' variant; with the
-- curated_first_workout flip that population IS the clean baseline cohort.
--
-- Lift read for the curated first-workout experiment (all-mature cohorts):
--   SELECT * FROM activation_funnel_by_variant(
--     'curated_first_workout', '2026-06-29 17:51:53+00', now() - interval '14 days');
--
-- Same cohort-maturity rules as activation_funnel_window: the north-star
-- metrics (3+ workouts / 14 days) are computed only over the matured subset
-- (signup_at <= now() - 14 days), with mature_signups as that denominator; cap
-- p_signup_to at now() - interval '14 days' for a fully-mature comparison.

CREATE OR REPLACE FUNCTION public.activation_funnel_by_variant(
  p_flag_key    text,
  p_signup_from timestamptz DEFAULT NULL,
  p_signup_to   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  variant text,
  total_signups bigint,
  mature_signups bigint,
  users_with_first_workout bigint,
  signup_to_first_workout_rate numeric,
  activated_24h_count bigint,
  activated_24h_rate numeric,
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
    COALESCE(ffa.variant, 'unassigned'),
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
  LEFT JOIN public.feature_flag_assignments ffa
    ON ffa.user_id = ua.user_id AND ffa.flag_key = p_flag_key
  WHERE (p_signup_from IS NULL OR ua.signup_at >= p_signup_from)
    AND (p_signup_to   IS NULL OR ua.signup_at <  p_signup_to)
  GROUP BY COALESCE(ffa.variant, 'unassigned');
$$;

-- Analyst-only, exactly like activation_funnel_window: aggregates across all
-- users, so service-role querying only — never exposed to anon/authenticated.
REVOKE ALL ON FUNCTION public.activation_funnel_by_variant(text, timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.activation_funnel_by_variant(text, timestamptz, timestamptz) TO service_role;
