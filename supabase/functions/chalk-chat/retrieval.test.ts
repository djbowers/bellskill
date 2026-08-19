import { vi } from 'vitest';

import {
  KNOWLEDGE_CHAR_BUDGET,
  KNOWLEDGE_MATCH_COUNT,
  buildRetrievalQuery,
  retrieveKnowledge,
} from './retrieval.ts';

// embedText touches the edge runtime's Supabase.ai global; stub it out.
vi.mock('../_shared/embeddings.ts', () => ({
  EMBEDDING_DIM: 384,
  embedText: vi.fn(async () => Array(384).fill(0.1)),
}));

const fakeAdmin = ({
  rows = [] as Array<Record<string, unknown>>,
  rpcError = null as { message: string } | null,
  trainingGoal = null as string | null,
} = {}) =>
  ({
    rpc: vi.fn(async () => ({ data: rows, error: rpcError })),
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { training_goal: trainingGoal } }),
        }),
      }),
    })),
    // Only rpc/from are exercised; the cast keeps the test honest about that.
  }) as never;

const row = (over: Record<string, unknown> = {}) => ({
  id: 'chunk-1',
  content: 'Simple & Sinister — Standards: 100 swings in 5 minutes.',
  metadata: { title: 'Simple & Sinister' },
  document_id: 'doc-1',
  source_table: null,
  source_id: null,
  rrf_score: 0.03,
  ...over,
});

describe('buildRetrievalQuery', () => {
  test('long questions pass through verbatim', () => {
    const q = 'how heavy should my swing bell be for simple and sinister today';
    expect(buildRetrievalQuery(q, 'press half bodyweight')).toBe(q);
  });

  test('short questions get the training goal prefixed for retrievable nouns', () => {
    expect(buildRetrievalQuery('how heavy?', 'pass the snatch test')).toBe(
      'pass the snatch test: how heavy?',
    );
  });

  test('short questions without a goal stay bare', () => {
    expect(buildRetrievalQuery('how heavy?', null)).toBe('how heavy?');
  });
});

describe('retrieveKnowledge', () => {
  test('returns sanitized chunks with the retrieval trace', async () => {
    const admin = fakeAdmin({
      rows: [row(), row({ id: 'chunk-2', rrf_score: 0.01 })],
    });
    const result = await retrieveKnowledge(
      admin,
      'user-1',
      'what is the simple and sinister swing standard for men please',
    );

    expect(result.chunks).toHaveLength(2);
    expect(result.chunk_ids).toEqual(['chunk-1', 'chunk-2']);
    expect(result.scores).toEqual([0.03, 0.01]);
    expect(result.error).toBeNull();
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
  });

  test('passes the knowledge scope and match count to the SQL function', async () => {
    const admin = fakeAdmin();
    await retrieveKnowledge(admin, 'user-1', 'longer question about training with bells today');
    const rpc = (admin as { rpc: ReturnType<typeof vi.fn> }).rpc;
    expect(rpc).toHaveBeenCalledWith(
      'chalk_hybrid_search',
      expect.objectContaining({
        match_scope: 'knowledge',
        match_count: KNOWLEDGE_MATCH_COUNT,
      }),
    );
  });

  test('strips control characters that could fake a prompt delimiter', async () => {
    const admin = fakeAdmin({
      rows: [row({ content: 'line one\u0000\u001f hostile text' })],
    });
    const result = await retrieveKnowledge(
      admin,
      'user-1',
      'another long enough question about kettlebell training methods here',
    );
    expect(result.chunks[0].content).toBe('line one hostile text');
  });

  test('drops lowest-ranked chunks past the character budget', async () => {
    const big = 'x'.repeat(1500);
    const admin = fakeAdmin({
      rows: [
        row({ id: 'a', content: big, rrf_score: 0.05 }),
        row({ id: 'b', content: big, rrf_score: 0.04 }),
        row({ id: 'c', content: big, rrf_score: 0.03 }),
        row({ id: 'd', content: big, rrf_score: 0.02 }),
      ],
    });
    const result = await retrieveKnowledge(
      admin,
      'user-1',
      'a long question that retrieves several very large corpus chunks',
    );
    const total = result.chunks.reduce((n, c) => n + c.content.length, 0);
    expect(total).toBeLessThanOrEqual(KNOWLEDGE_CHAR_BUDGET);
    expect(result.chunks.length).toBeLessThan(4);
  });

  test('degrades to empty chunks on rpc failure — never throws', async () => {
    const admin = fakeAdmin({ rpcError: { message: 'relation does not exist' } });
    const result = await retrieveKnowledge(
      admin,
      'user-1',
      'a long enough question that would normally hit the corpus',
    );
    expect(result.chunks).toEqual([]);
    expect(result.error).toBeTruthy();
  });
});
