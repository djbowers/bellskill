// stripe-webhook (PROD-105)
//
// The ONLY writer of the subscription state columns. Keeps Supabase in sync with
// Stripe. Authenticated by the Stripe signature (no Supabase JWT). On every
// subscription event it re-fetches the live subscription from Stripe and writes
// that authoritative state, which makes handling idempotent and safe against
// out-of-order / replayed events.

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});
// Deno requires the async/SubtleCrypto signature verification path.
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

// Service-role client: bypasses RLS / the column write-lock to write the
// service-role-only subscription columns.
const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Stripe statuses that should retain premium access. past_due keeps access
// through the dunning window Stripe manages; terminal states downgrade to free.
const PREMIUM_STATUSES = new Set(['active', 'trialing', 'past_due']);
const tierFor = (status: string) =>
  PREMIUM_STATUSES.has(status) ? 'premium' : 'free';

type ProfileFilter = { column: 'id' | 'stripe_customer_id'; value: string };

// deno-lint-ignore no-explicit-any
async function writeSubscriptionState(filter: ProfileFilter, sub: any) {
  const update: Record<string, unknown> = {
    subscription_tier: tierFor(sub.status),
    subscription_status: sub.status,
    stripe_subscription_id: sub.id,
    current_period_end: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
  };

  const { error, count } = await admin
    .from('profiles')
    .update(update, { count: 'exact' })
    .eq(filter.column, filter.value);

  if (error) throw error;
  return count ?? 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const signature = req.headers.get('stripe-signature');
  const body = await req.text(); // raw body — required for signature verification

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature ?? '',
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err.message);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // deno-lint-ignore no-explicit-any
        const session = event.data.object as any;
        const userId: string | null = session.client_reference_id ?? null;
        const customerId: string | null = session.customer ?? null;
        const subId: string | null = session.subscription ?? null;

        if (!userId || !subId) {
          console.warn(
            `[stripe-webhook] ${event.id} checkout.session.completed missing user/subscription`,
          );
          break;
        }

        const sub = await stripe.subscriptions.retrieve(subId);
        // (Re)link the customer in case create-checkout-session didn't persist it.
        if (customerId) {
          await admin
            .from('profiles')
            .update({ stripe_customer_id: customerId })
            .eq('id', userId);
        }
        const rows = await writeSubscriptionState(
          { column: 'id', value: userId },
          sub,
        );
        console.log(
          `[stripe-webhook] ${event.id} checkout.session.completed user=${userId} status=${sub.status} rows=${rows}`,
        );
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // deno-lint-ignore no-explicit-any
        const obj = event.data.object as any;
        // Re-fetch for authoritative latest state (out-of-order safety).
        const sub = await stripe.subscriptions.retrieve(obj.id);
        const customerId = String(sub.customer);
        const rows = await writeSubscriptionState(
          { column: 'stripe_customer_id', value: customerId },
          sub,
        );
        console.log(
          `[stripe-webhook] ${event.id} ${event.type} customer=${customerId} status=${sub.status} rows=${rows}`,
        );
        break;
      }

      default:
        console.log(`[stripe-webhook] ${event.id} ${event.type} ignored`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // 500 so Stripe retries.
    console.error(`[stripe-webhook] ${event.id} ${event.type} handler error:`, err);
    return new Response('Handler error', { status: 500 });
  }
});
