// recommend-program: the LLM provider boundary.
//
// This is the ONLY module that talks to a specific LLM provider — same
// contract as recommend-session/llm.ts. Raw fetch to the Anthropic Messages
// API rather than @anthropic-ai/sdk: the SDK's esm.sh type graph fails to
// bootstrap in the Supabase edge runtime, and a single structured-outputs call
// needs no SDK surface.

import {
  buildCorrectionPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from './prompt.ts';
import type { ProgramRecommendation, RecommenderInputs } from './types.ts';
import { RECOMMENDATION_SCHEMA } from './types.ts';
import { ValidationError, validateRecommendation } from './validate.ts';

const API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 1024;

/** Transport/parse-level failure (API down, bad JSON) — distinct from ValidationError. */
export class LLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMError';
  }
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
}

/**
 * Generate a validated recommendation. Calls the model, validates the output,
 * and retries once with a correction if validation fails. Throws LLMError on a
 * transport/parse failure and ValidationError if the retry also fails.
 */
export async function generateRecommendation(
  inputs: RecommenderInputs,
): Promise<ProgramRecommendation> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new LLMError('ANTHROPIC_API_KEY is not configured');

  const system = buildSystemPrompt();
  const messages: Message[] = [
    { role: 'user', content: buildUserPrompt(inputs) },
  ];

  // First attempt, then one corrective retry on validation failure.
  for (let attempt = 0; attempt < 2; attempt++) {
    const rec = await callModel(apiKey, system, messages);
    try {
      validateRecommendation(rec, inputs);
      return rec;
    } catch (err) {
      if (!(err instanceof ValidationError) || attempt === 1) throw err;
      // Feed the failure back and let the model fix it.
      messages.push({ role: 'assistant', content: JSON.stringify(rec) });
      messages.push({
        role: 'user',
        content: buildCorrectionPrompt(err.reasons),
      });
    }
  }

  // Unreachable: the loop either returns or throws.
  throw new LLMError('recommendation generation exhausted retries');
}

async function callModel(
  apiKey: string,
  system: string,
  messages: Message[],
): Promise<ProgramRecommendation> {
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: 'disabled' },
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: RECOMMENDATION_SCHEMA },
        },
        system,
        messages,
      }),
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

  const text = (payload.content ?? [])
    .map((block) => (block.type === 'text' ? (block.text ?? '') : ''))
    .join('')
    .trim();
  if (!text) throw new LLMError('model returned no text content');

  try {
    return JSON.parse(text) as ProgramRecommendation;
  } catch {
    throw new LLMError('model returned invalid JSON');
  }
}
