// chalk-chat: Chalk, the AI kettlebell coach.
//
// Authenticated, premium-gated chat endpoint. The user is derived from the JWT
// (never trusted from the body). Mirrors recommend-session's auth + service-role
// pattern. The service role is the SOLE writer of chalk_threads/chalk_messages —
// see the migration for why that matters more here than it does for the
// recommenders (every message row is replayed to the model as history).
//
// This phase is non-streaming: it returns one JSON reply. The streaming path
// lands on top of the same auth/gate/context/persist spine.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { gatherContext } from './inputs.ts';
import { generateReply, LLMError, MODEL } from './llm.ts';
import { buildMessages, buildSystemPrompt } from './prompt.ts';
import type { ChalkTurn } from './types.ts';

/** Prior turns replayed into the prompt. Bounds cost per turn. */
const HISTORY_LIMIT = 20;
const HISTORY_MAX_CHARS = 4000;

/** Chat is unbounded in a way the one-shot recommenders are not, and no other
 *  Edge Function in this project rate-limits. These are the guard rails. */
const DAILY_MESSAGE_CAP = 50;
const MAX_TURNS_PER_THREAD = 50;
const MAX_INPUT_CHARS = 2000;

/** Title shown in the thread list, derived from the opening message. */
const TITLE_MAX_CHARS = 60;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function deriveTitle(message: string): string {
  const collapsed = message.replace(/\s+/g, ' ').trim();
  return collapsed.length > TITLE_MAX_CHARS
    ? `${collapsed.slice(0, TITLE_MAX_CHARS - 1)}…`
    : collapsed;
}

/**
 * Per-user daily cap on sent messages. Counts user rows only, so a failed
 * generation doesn't burn quota twice.
 */
async function isOverDailyCap(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { count, error } = await admin
    .from('chalk_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', since.toISOString());
  if (error) throw error;

  return (count ?? 0) >= DAILY_MESSAGE_CAP;
}

/**
 * Resolve the thread to append to, creating one if needed. The admin client
 * bypasses RLS, so the ownership check here IS the security boundary — without
 * it any caller could append to any thread by guessing an id.
 */
async function resolveThread(
  admin: SupabaseClient,
  userId: string,
  threadId: string | null,
  message: string,
): Promise<{ id: string } | { error: 'thread_not_found' | 'thread_full' }> {
  if (!threadId) {
    const { data, error } = await admin
      .from('chalk_threads')
      .insert({ user_id: userId, title: deriveTitle(message) })
      .select('id')
      .single();
    if (error) throw error;
    return { id: data.id };
  }

  const { data: thread, error } = await admin
    .from('chalk_threads')
    .select('id, user_id')
    .eq('id', threadId)
    .maybeSingle();
  if (error) throw error;
  if (!thread || thread.user_id !== userId) return { error: 'thread_not_found' };

  const { count, error: countErr } = await admin
    .from('chalk_messages')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', threadId);
  if (countErr) throw countErr;
  if ((count ?? 0) >= MAX_TURNS_PER_THREAD * 2) return { error: 'thread_full' };

  return { id: thread.id };
}

/** The thread's prior turns, oldest first, truncated for the prompt. */
async function loadHistory(
  admin: SupabaseClient,
  threadId: string,
): Promise<ChalkTurn[]> {
  const { data, error } = await admin
    .from('chalk_messages')
    .select('role, content')
    .eq('thread_id', threadId)
    .order('seq', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;

  return (data ?? [])
    .reverse()
    .map((m) => ({
      role: m.role as ChalkTurn['role'],
      content:
        m.content.length > HISTORY_MAX_CHARS
          ? `${m.content.slice(0, HISTORY_MAX_CHARS)}…`
          : m.content,
    }));
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

    // (2) Service-role client: premium check + RLS-bypassing reads/writes.
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // (3) Gate on the single source of truth for entitlement.
    const { data: hasPremium, error: gateErr } = await admin.rpc(
      'has_premium_access',
      { user_id: user.id },
    );
    if (gateErr) throw gateErr;
    if (!hasPremium) {
      return json({ error: 'premium_required', paywall_trigger: true }, 401);
    }

    // (4) Validate the body.
    const body = await req.json().catch(() => ({}));
    const message =
      typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return json({ error: 'empty_message' }, 400);
    if (message.length > MAX_INPUT_CHARS) {
      return json({ error: 'message_too_long', max: MAX_INPUT_CHARS }, 400);
    }
    const threadId =
      typeof body.thread_id === 'string' && body.thread_id ? body.thread_id : null;

    // (5) Rate limit before doing any expensive work.
    if (await isOverDailyCap(admin, user.id)) {
      return json({ error: 'rate_limited', cap: DAILY_MESSAGE_CAP }, 429);
    }

    // (6) Resolve the thread — ownership-checked.
    const resolved = await resolveThread(admin, user.id, threadId, message);
    if ('error' in resolved) {
      return json(
        { error: resolved.error },
        resolved.error === 'thread_full' ? 400 : 404,
      );
    }

    // (7) History is read BEFORE the user row is inserted, so the new message
    // appears once (as the final turn) rather than twice.
    const history = await loadHistory(admin, resolved.id);

    // (8) Persist the user message before calling the model, so it survives a
    // generation failure and the lifter never loses what they typed.
    const { data: userRow, error: userInsErr } = await admin
      .from('chalk_messages')
      .insert({
        thread_id: resolved.id,
        user_id: user.id,
        role: 'user',
        content: message,
      })
      .select('id')
      .single();
    if (userInsErr) throw userInsErr;

    // (9) Assemble context and generate.
    const context = await gatherContext(admin, authClient, user.id, body);
    const system = buildSystemPrompt(context);
    const messages = buildMessages(history, message);

    try {
      const reply = await generateReply(system, messages);

      const { data: assistantRow, error: insErr } = await admin
        .from('chalk_messages')
        .insert({
          thread_id: resolved.id,
          user_id: user.id,
          role: 'assistant',
          content: reply.text,
          status: 'complete',
          model: MODEL,
          input_tokens: reply.input_tokens,
          output_tokens: reply.output_tokens,
          context,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;

      await admin
        .from('chalk_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', resolved.id);

      return json(
        {
          thread_id: resolved.id,
          user_message_id: userRow.id,
          assistant_message_id: assistantRow.id,
          reply: reply.text,
        },
        200,
      );
    } catch (genErr) {
      if (genErr instanceof LLMError) {
        // Log the failed turn so prompt iteration can see it, exactly as
        // session_recommendations logs its error rows.
        await admin.from('chalk_messages').insert({
          thread_id: resolved.id,
          user_id: user.id,
          role: 'assistant',
          content: '',
          status: 'error',
          error: genErr.message,
          model: MODEL,
          context,
        });
        console.error('chalk-chat generation error:', genErr);
        return json({ error: 'chalk_failed', thread_id: resolved.id }, 502);
      }
      throw genErr;
    }
  } catch (err) {
    console.error('chalk-chat error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
