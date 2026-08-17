// chalk-chat: the LLM provider boundary.
//
// This is the ONLY module that talks to a specific LLM provider. Everything else
// works in terms of (system prompt, ChalkTurn[]) -> reply text. To swap providers
// later, reimplement generateReply here and leave the rest of the function alone.
//
// We call the Anthropic Messages API over raw fetch rather than @anthropic-ai/sdk
// for the same reason recommend-session does: the SDK's esm.sh type graph fails
// to bootstrap in the Supabase edge runtime.

import type { ChalkTurn } from './types.ts';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export const MODEL = 'claude-opus-5';

// Thinking is ON by default on this model and max_tokens bounds thinking PLUS
// response text, so this needs headroom well above the few sentences Chalk
// actually replies with. Do not set thinking:{type:'disabled'} to reclaim it —
// on this model that can leak <thinking> tags straight into the chat bubble.
const MAX_TOKENS = 4096;

// Low effort is the cost/latency lever for a chat turn. Note it does NOT
// reliably shorten the visible reply — the prompt's length rules do that.
const EFFORT = 'low';

/** Transport/parse-level failure (API down, bad JSON, refusal). */
export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMError';
  }
}

export interface ChalkReply {
  text: string;
  stop_reason: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
  stop_details?: { category?: string } | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export function buildRequestBody(
  system: string,
  messages: ChalkTurn[],
  stream: boolean,
): Record<string, unknown> {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: EFFORT },
    system,
    messages,
    ...(stream ? { stream: true } : {}),
  };
}

export function requestHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'content-type': 'application/json',
  };
}

export function apiKeyOrThrow(): string {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new LLMError('ANTHROPIC_API_KEY is not configured');
  return apiKey;
}

/** Non-streaming generation. The streaming path lives in stream.ts. */
export async function generateReply(
  system: string,
  messages: ChalkTurn[],
): Promise<ChalkReply> {
  const apiKey = apiKeyOrThrow();

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: requestHeaders(apiKey),
      body: JSON.stringify(buildRequestBody(system, messages, false)),
    });
  } catch (err) {
    throw new LLMError(
      `Anthropic request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LLMError(`Anthropic API ${res.status}: ${detail.slice(0, 300)}`);
  }

  let payload: AnthropicResponse;
  try {
    payload = (await res.json()) as AnthropicResponse;
  } catch {
    throw new LLMError('Anthropic returned a non-JSON response');
  }

  // A safety refusal is HTTP 200 with empty or partial content, so this has to
  // be checked before reading content — indexing content[0] would break.
  if (payload.stop_reason === 'refusal') {
    throw new LLMError(
      `model declined the request (${payload.stop_details?.category ?? 'unspecified'})`,
    );
  }

  const text = (payload.content ?? [])
    .map((block) => (block.type === 'text' ? (block.text ?? '') : ''))
    .join('')
    .trim();
  if (!text) throw new LLMError('model returned no text content');

  return {
    text,
    stop_reason: payload.stop_reason ?? null,
    input_tokens: payload.usage?.input_tokens ?? null,
    output_tokens: payload.usage?.output_tokens ?? null,
  };
}
