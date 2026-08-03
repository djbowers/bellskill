// recommend-program
//
// Authenticated, premium-gated endpoint that recommends ONE shared program —
// and whether to start it now alongside the current stack ("concurrent") or
// queue it for when a current program finishes ("queue"). The user is derived
// from the JWT (never trusted from the body). Mirrors recommend-session's
// auth + service-role pattern. The service role is the SOLE writer of
// program_recommendations; every attempt (success or error) is logged there
// for analytics + prompt iteration.

import { createClient } from '@supabase/supabase-js';

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { gatherInputs } from './inputs.ts';
import { generateRecommendation, LLMError } from './llm.ts';
import { ValidationError } from './validate.ts';

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

    // (1) Identity: anon client bound to the caller's JWT. Also used for the
    // SECURITY INVOKER pattern_debt_window RPC, which scopes on auth.uid().
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

    // (2) Service-role client: premium check + RLS-bypassing reads/writes.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // (3) Gate on the single source of truth for entitlement. Free users get a
    // paywall trigger, not a recommendation.
    const { data: hasPremium, error: gateErr } = await admin.rpc(
      'has_premium_access',
      { user_id: user.id },
    );
    if (gateErr) throw gateErr;
    if (!hasPremium) {
      return json({ error: 'premium_required', paywall_trigger: true }, 401);
    }

    // (4) Assemble inputs.
    const body = await req.json().catch(() => ({}));
    const inputs = await gatherInputs(admin, authClient, user.id, body);

    if (inputs.candidates.length === 0) {
      // The user is already running or has queued every released shared
      // program — a user-state issue, not an LLM error, so it is not logged as
      // a generation attempt.
      return json({ error: 'no_candidates' }, 422);
    }

    // (5) Generate (with one internal corrective retry), validate, persist.
    try {
      const recommendation = await generateRecommendation(inputs);

      const { data: row, error: insErr } = await admin
        .from('program_recommendations')
        .insert({
          user_id: user.id,
          inputs,
          output: recommendation,
          status: 'generated',
          program_id: recommendation.program_id,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;

      return json({ id: row.id, recommendation }, 200);
    } catch (genErr) {
      if (genErr instanceof LLMError || genErr instanceof ValidationError) {
        // Log the failed attempt for prompt iteration, then surface a 502.
        await admin.from('program_recommendations').insert({
          user_id: user.id,
          inputs,
          status: 'error',
          error: genErr.message,
        });
        console.error('recommend-program generation error:', genErr);
        return json({ error: 'recommendation_failed' }, 502);
      }
      throw genErr;
    }
  } catch (err) {
    console.error('recommend-program error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
