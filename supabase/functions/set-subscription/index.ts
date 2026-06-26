// set-subscription (owner-only)
//
// Lets an owner flip a user's subscription state (free / premium / trialing).
// The subscription columns on profiles are write-locked from clients (column-
// level grants in the entitlement migration), so the only legitimate writer is
// the service role. This function authenticates the caller, checks they're an
// owner, then writes via the service role.
//
// Primary use: manual QA of premium vs free vs trialing surfaces. Also general
// enough to grant premium to a specific user (pass targetUserId).

import { createClient } from '@supabase/supabase-js';

import { corsHeaders, handleCors } from '../_shared/cors.ts';

type SubscriptionState = 'free' | 'premium' | 'trialing';

const STATES: readonly SubscriptionState[] = ['free', 'premium', 'trialing'];

const TRIAL_DAYS = 30;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Server-side owner allowlist. Mirrors src/config/features.ts OWNER_EMAILS, but
// is the real boundary — the client list is UI-gating only. Configurable via the
// OWNER_EMAILS env var (comma-separated); falls back to the known owner.
function ownerEmails(): string[] {
  const raw = Deno.env.get('OWNER_EMAILS');
  if (!raw) return ['daniel_bowers@icloud.com'];
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Maps a QA state to the subscription columns. Only subscription_tier and
// trial_ends_at affect entitlement (has_premium_access); subscription_status is
// cosmetic, set for realism.
function columnsFor(state: SubscriptionState): Record<string, unknown> {
  switch (state) {
    case 'premium':
      return {
        subscription_tier: 'premium',
        trial_ends_at: null,
        subscription_status: 'active',
      };
    case 'trialing':
      return {
        subscription_tier: 'free',
        trial_ends_at: new Date(
          Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString(),
        subscription_status: 'trialing',
      };
    case 'free':
      return {
        subscription_tier: 'free',
        trial_ends_at: null,
        subscription_status: null,
      };
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);

    // (1) Identity: anon client bound to the caller's JWT.
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: userErr,
    } = await authClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401);

    // (2) Owner gate — the real boundary for this privileged write.
    const email = user.email?.toLowerCase();
    if (!email || !ownerEmails().includes(email)) {
      return json({ error: 'Forbidden' }, 403);
    }

    // (3) Validate input.
    const body = await req.json().catch(() => null);
    const state = body?.state as SubscriptionState | undefined;
    if (!state || !STATES.includes(state)) {
      return json({ error: 'Invalid state' }, 400);
    }
    const targetUserId =
      typeof body?.targetUserId === 'string' && body.targetUserId
        ? body.targetUserId
        : user.id;

    // (4) Service-role write — bypasses the column-level write lock.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { error, count } = await admin
      .from('profiles')
      .update(columnsFor(state), { count: 'exact' })
      .eq('id', targetUserId);
    if (error) throw error;
    if (!count) return json({ error: 'Profile not found' }, 404);

    return json({ ok: true, state }, 200);
  } catch (err) {
    console.error('set-subscription error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
