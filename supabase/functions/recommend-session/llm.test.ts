import { LLMError, generateRecommendation } from './llm.ts';
import type { Recommendation, RecommenderInputs } from './types.ts';
import { ValidationError } from './validate.ts';

const inputs: RecommenderInputs = {
  balance_targets: [],
  training_goal: null,
  readiness: null,
  days_since_last_workout: null,
  recent_history: [],
  candidates: [
    { user_movement_id: 'swing', name: 'Swing', is_big_6: true, pattern_credits: ['hinge'] },
    { user_movement_id: 'press', name: 'Press', is_big_6: true, pattern_credits: ['push'] },
  ],
  pattern_debt: null,
  unlocked_weights: {},
};

const block = (over: Partial<Recommendation['blocks'][number]> = {}) => ({
  user_movement_id: 'swing',
  movement_name: 'Swing',
  weight_kg: 24,
  rep_scheme: [5, 5, 5],
  notes: '',
  ...over,
});

const recommendation = (over: Partial<Recommendation> = {}): Recommendation => ({
  rationale: 'test',
  duration_minutes: 20,
  format: 'Circuit',
  confidence: 'high',
  blocks: [block()],
  ...over,
});

/** A recommendation the shared verifier rejects: 4 rungs against 3 in a circuit. */
const unequalRungs = recommendation({
  blocks: [
    block({ rep_scheme: [1, 2, 3, 4] }),
    block({ user_movement_id: 'press', movement_name: 'Press', rep_scheme: [5, 5, 5] }),
  ],
});

const jsonResponse = (rec: Recommendation) =>
  new Response(
    JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(rec) }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

/** Bodies of every Anthropic request made during a call, in order. */
let sentBodies: Array<{ system: string; messages: Array<{ role: string; content: string }> }>;

const stubModel = (responses: Recommendation[]) => {
  const queue = [...responses];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      sentBodies.push(JSON.parse(init.body as string));
      const next = queue.shift();
      if (!next) throw new Error('model called more times than stubbed');
      return jsonResponse(next);
    }),
  );
};

beforeEach(() => {
  sentBodies = [];
  vi.stubGlobal('Deno', { env: { get: () => 'test-key' } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generateRecommendation — corrective retry', () => {
  test('a sound first attempt returns without a retry', async () => {
    stubModel([recommendation()]);

    await expect(generateRecommendation(inputs)).resolves.toMatchObject({
      format: 'Circuit',
    });
    expect(sentBodies).toHaveLength(1);
  });

  test('an unrunnable attempt retries exactly once, carrying the rule message', async () => {
    stubModel([unequalRungs, recommendation()]);

    await expect(generateRecommendation(inputs)).resolves.toMatchObject({
      format: 'Circuit',
    });
    expect(sentBodies).toHaveLength(2);

    const correction = sentBodies[1].messages.at(-1);
    expect(correction?.role).toBe('user');
    expect(correction?.content).toContain('Rep schemes differ across movements');
    // Rung equality is a whole-session property, so it is not pinned to a block.
    expect(correction?.content).toContain('the session —');
  });

  test('a second failure throws ValidationError and makes no third call', async () => {
    stubModel([unequalRungs, unequalRungs]);

    await expect(generateRecommendation(inputs)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(sentBodies).toHaveLength(2);
  });

  test('the system prompt states the runnability rules up front', async () => {
    stubModel([recommendation()]);
    await generateRecommendation(inputs);

    expect(sentBodies[0].system).toContain('Runnability');
    expect(sentBodies[0].system).toContain('Straight Sets');
  });

  test('a missing API key fails before any request', async () => {
    vi.stubGlobal('Deno', { env: { get: () => undefined } });
    stubModel([]);

    await expect(generateRecommendation(inputs)).rejects.toBeInstanceOf(LLMError);
    expect(sentBodies).toHaveLength(0);
  });
});
