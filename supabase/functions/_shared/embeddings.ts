// The embedding provider boundary (PROD-248) — the only module that knows
// which embedding model Chalk retrieval uses. Everything else works in terms
// of text -> number[].
//
// Provider: Supabase's built-in gte-small (384-dim), via the edge runtime's
// Supabase.ai API. Chosen over a hosted embedding API (Voyage, OpenAI) because
// it is free, needs no new secret, and runs in-process so embedding a chat
// query adds ~10-30ms instead of a network round trip. The small corpus plus
// the lexical leg of chalk_hybrid_search covers the quality gap of a 384-dim
// model — measured in scripts/eval/.
//
// Swapping providers means reimplementing embedText here (fetch instead of
// Session), changing EMBEDDING_DIM, and migrating chalk_chunks.embedding to
// the new vector(N) — every stored chunk must be re-embedded, because vectors
// from different models share no space.

export const EMBEDDING_DIM = 384;

// Deno's Supabase edge runtime injects this global; it has no published types.
declare const Supabase: {
  ai: {
    Session: new (model: string) => {
      run: (
        input: string,
        options: { mean_pool: boolean; normalize: boolean },
      ) => Promise<number[]>;
    };
  };
};

// Lazy so warm invocations reuse the loaded model, while importing this module
// outside the edge runtime (Vitest) stays safe until embedText is called.
type AiSession = InstanceType<typeof Supabase.ai.Session>;
let session: AiSession | null = null;
function getSession(): AiSession {
  session ??= new Supabase.ai.Session('gte-small');
  return session;
}

/** gte-small's context window is 512 tokens; longer input is truncated by the
 *  model. Chunking (~300 tokens) keeps stored content inside it — this guard
 *  only bounds pathological input. */
const MAX_INPUT_CHARS = 4000;

export async function embedText(text: string): Promise<number[]> {
  const input = text.slice(0, MAX_INPUT_CHARS);
  const embedding = await getSession().run(input, {
    mean_pool: true,
    normalize: true,
  });
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIM) {
    throw new Error(
      `embedText: expected ${EMBEDDING_DIM}-dim vector, got ${
        Array.isArray(embedding) ? embedding.length : typeof embedding
      }`,
    );
  }
  return embedding;
}
