-- Paywall v1 (PROD-102): premium-launch trial backfill — DO NOT AUTO-APPLY.
--
-- This file lives OUTSIDE supabase/migrations/ on purpose. Migrations in that
-- directory auto-deploy on merge via .github/workflows/supabase-*.yaml. Per the
-- PROD-99 epic decision, the 30-day trial clock starts at *premium launch* (when
-- the first premium feature ships), not at signup — so this must run exactly
-- once, at launch, not before.
--
-- HOW TO RUN AT LAUNCH:
--   1. Replace the launch timestamp below with the actual launch date.
--   2. Copy this file into supabase/migrations/ with a fresh timestamp prefix
--      (e.g. 2026MMDDHHMMSS_premium_launch_trial_backfill.sql) and merge — CI
--      will apply it. Then delete this manual copy.
--
-- Epic decision: EVERY existing user gets a fresh 30-day clock regardless of
-- signup date.

BEGIN;

-- 1. Backfill all existing users to a fresh 30-day trial from launch.
--    Only stamp rows that don't already have a trial set, so re-running is safe.
--    The DO block aborts with a clear message if the launch date is still unset,
--    rather than failing later with a cryptic timestamp parse error.
DO $$
DECLARE
  -- TODO at launch: set to the launch date, e.g. TIMESTAMPTZ '2026-07-01 00:00:00+00'.
  launch_date timestamptz := NULL;
BEGIN
  IF launch_date IS NULL THEN
    RAISE EXCEPTION 'Set launch_date before running the premium launch backfill.';
  END IF;

  UPDATE public.profiles
  SET trial_ends_at = launch_date + interval '30 days'
  WHERE trial_ends_at IS NULL;
END $$;

-- 2. New signups from launch onward are auto-stamped server-side (no client
--    code). The handle_new_user trigger inserts profiles without trial_ends_at,
--    so this column default supplies the 30-day clock.
ALTER TABLE public.profiles
  ALTER COLUMN trial_ends_at SET DEFAULT now() + interval '30 days';

COMMIT;
