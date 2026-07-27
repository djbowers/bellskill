-- Enable the curated first-workout treatment (PROD-172).
--
-- The clean pure-builder baseline has fully matured: PROD-174 turned the
-- curated / repeat-previous surfaces OFF at 2026-06-29 17:51 UTC, and the
-- 14-day north-star window for that flags-OFF cohort closed on 2026-07-13.
-- This flips the intervention on for the before/after read.
--
-- rollout_percentage = 100: every user who evaluates the flag from here on is
-- bucketed into treatment and gets a sticky feature_flag_assignments row
-- (variant + assigned_at), which is what makes the lift attributable — see
-- activation_funnel_by_variant. The surface itself still only renders for the
-- new-user population (0 workout logs), so returning users are unaffected.
-- No assignment rows exist from the disabled period (disabled flags resolve to
-- default_variant without writing one), so nobody is stuck in a stale bucket.
UPDATE public.feature_flags
SET enabled = true,
    rollout_percentage = 100
WHERE key = 'curated_first_workout';
