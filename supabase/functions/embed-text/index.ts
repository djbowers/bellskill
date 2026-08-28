// embed-text: infrastructure-only embedding endpoint (PROD-248).
//
// Exists so Node-side tooling (scripts/ingest-chalk-knowledge.mjs, the eval
// harness) embeds with the EXACT same model and runtime as query-time
// retrieval in chalk-chat — ingestion-time/query-time embedding-space mismatch
// is the classic silent RAG failure, and one implementation makes it
// impossible. Clients never call this; chalk-chat embeds in-process via
// _shared/embeddings.ts, not over HTTP.
//
// Auth: the caller must present the EMBED_TEXT_TOKEN secret as the bearer
// token (set via `supabase secrets set EMBED_TEXT_TOKEN=...`; any long random
// string). The service-role key is accepted as a fallback so the local stack
// works with zero setup — but hosted projects migrated to Supabase's new API
// key system may inject a service-key value that differs from the dashboard's
// legacy JWT, which is exactly why the dedicated token is the primary path:
// this endpoint's authorization should not depend on platform key plumbing.
// verify_jwt is OFF for this function (stripe-webhook precedent): the
// gateway's JWT validation would reject the random-string token before this
// check could run, so the in-function compare is the sole gate.

import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { embedText } from '../_shared/embeddings.ts';

const MAX_TEXTS = 50;
const MAX_TEXT_CHARS = 4000;

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
    const embedToken = Deno.env.get('EMBED_TEXT_TOKEN') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const bearer = (req.headers.get('Authorization') ?? '').replace(
      /^Bearer\s+/i,
      '',
    );
    const authorized =
      (embedToken !== '' && bearer === embedToken) ||
      (serviceRoleKey !== '' && bearer === serviceRoleKey);
    if (!authorized) {
      return json({ error: 'Forbidden' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const texts = Array.isArray(body.texts) ? body.texts : null;
    if (
      !texts ||
      texts.length === 0 ||
      texts.length > MAX_TEXTS ||
      texts.some((t: unknown) => typeof t !== 'string' || t.length === 0)
    ) {
      return json(
        { error: `texts must be 1-${MAX_TEXTS} non-empty strings` },
        400,
      );
    }
    if (texts.some((t: string) => t.length > MAX_TEXT_CHARS)) {
      return json({ error: `each text must be <= ${MAX_TEXT_CHARS} chars` }, 400);
    }

    // Sequential on purpose: one model session, and batches are small.
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await embedText(text));
    }

    return json({ embeddings }, 200);
  } catch (err) {
    console.error('embed-text error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
