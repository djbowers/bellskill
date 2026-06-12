// create-checkout-session (PROD-104)
//
// Authenticated endpoint that creates a Stripe Checkout Session for a premium
// subscription. The user is derived from the JWT (never trusted from the body),
// and the price is mapped server-side from a `plan` selector so the client can
// never choose an arbitrary price.
//
// This function creates/reuses the Stripe customer and writes stripe_customer_id
// via the service role (that column is write-locked from clients). The webhook
// (PROD-105) owns the rest of the subscription state.

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

import { corsHeaders, handleCors } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICE_BY_PLAN: Record<string, string | undefined> = {
  monthly: Deno.env.get('STRIPE_PRICE_MONTHLY'),
  yearly: Deno.env.get('STRIPE_PRICE_YEARLY'),
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

    // Map plan -> price id server-side; never trust a client-supplied price.
    const { plan } = await req.json().catch(() => ({}));
    const price = PRICE_BY_PLAN[plan];
    if (!price) return json({ error: 'Invalid plan' }, 400);

    // (2) Service-role client for the write-locked stripe_customer_id column.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();
    if (profErr) throw profErr;

    // Create or reuse the Stripe customer; persist on first creation.
    let customerId: string | null = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      const { error: updErr } = await admin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
      if (updErr) throw updErr;
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? '';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      client_reference_id: user.id,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout/cancel`,
      allow_promotion_codes: false,
    });

    return json({ url: session.url }, 200);
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
