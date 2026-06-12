-- Paywall v1 (PROD-100): subscription state on profiles + has_premium_access().
--
-- Phase 1: no payments wired. trial_ends_at is left nullable with NO default;
-- the trial-start default and the launch backfill are gated to premium launch
-- (see supabase/manual/premium_launch_backfill.sql). Until then nobody is
-- "trialing" — has_premium_access returns false for everyone, which is correct
-- because no premium feature exists to gate yet.

ALTER TABLE public.profiles
  ADD COLUMN subscription_tier text NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'premium')),
  ADD COLUMN trial_ends_at timestamptz,
  ADD COLUMN stripe_customer_id text,
  ADD COLUMN stripe_subscription_id text,
  ADD COLUMN subscription_status text,
  ADD COLUMN current_period_end timestamptz;

-- Write-lock the subscription columns from clients. RLS governs row access but
-- cannot restrict individual columns, so we use column-level privileges: revoke
-- blanket UPDATE/INSERT from authenticated and grant them back only on the
-- user-editable profile columns. The subscription columns become writable solely
-- by the service role (the Stripe webhook Edge Function in Phase 2 / PROD-105).
--
-- INSERT must be locked too, not just UPDATE: profiles has an INSERT policy
-- (auth.uid() = id) AND a DELETE policy, so a user could otherwise delete their
-- own row and re-insert it with subscription_tier='premium', self-granting
-- premium. Column-level INSERT keeps the legitimate client insert path
-- (resolveAuthSession's ensureProfile inserts id/full_name/avatar_url) working
-- while making the subscription columns un-settable from the client.
REVOKE UPDATE, INSERT ON public.profiles FROM authenticated;
GRANT UPDATE (username, full_name, avatar_url, website, updated_at)
  ON public.profiles TO authenticated;
GRANT INSERT (id, username, full_name, avatar_url, website, updated_at)
  ON public.profiles TO authenticated;

-- Single source of truth for the entitlement rule. Phase-2 RLS policies on
-- premium feature tables and any future FastAPI endpoint derive from this; the
-- client useEntitlement hook mirrors the same rule for UX only.
CREATE OR REPLACE FUNCTION public.has_premium_access(user_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_id
      AND (
        p.subscription_tier = 'premium'
        OR (p.trial_ends_at IS NOT NULL AND now() < p.trial_ends_at)
      )
  );
$$;
