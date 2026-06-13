// create-portal-session (PROD-106)
//
// Authenticated endpoint that opens a Stripe Customer Portal session for the
// current user so they can manage/cancel their subscription and update payment
// methods. The user is derived from the JWT; the customer is looked up from the
// user's profile (service role).

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

import { corsHeaders, handleCors } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});

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

    const customerId = profile?.stripe_customer_id;
    if (!customerId) return json({ error: 'No subscription' }, 400);

    const siteUrl = Deno.env.get('SITE_URL') ?? '';
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/account`,
    });

    return json({ url: session.url }, 200);
  } catch (err) {
    console.error('create-portal-session error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
