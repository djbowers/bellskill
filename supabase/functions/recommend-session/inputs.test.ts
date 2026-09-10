import { summarizeSkillTree } from '../../../src/utils/skillTreeProgress.ts';
import { type CatalogRow, applySkillCeiling, toCandidates } from './inputs.ts';

const row = (over: Partial<CatalogRow> = {}): CatalogRow => ({
  id: 'id-swing',
  Movement: 'Kettlebell Swing',
  pattern_credits: ['hinge'],
  'Primary Equipment': 'Kettlebell',
  '# Primary Items': 1,
  unilateral_lower: false,
  skill_node_id: null,
  ...over,
});

describe('toCandidates — catalog rows become the candidate set', () => {
  test('maps the catalog columns onto a candidate', () => {
    expect(toCandidates([row()])).toEqual([
      {
        movement_id: 'id-swing',
        name: 'Kettlebell Swing',
        pattern_credits: ['hinge'],
        bodyweight: false,
        supports_doubles: false,
        unilateral_lower: false,
        skill_node_id: null,
      },
    ]);
  });

  test('a Bodyweight row is a bodyweight candidate', () => {
    const [candidate] = toCandidates([
      row({ Movement: 'Push-Up', 'Primary Equipment': 'Bodyweight' }),
    ]);
    expect(candidate.bodyweight).toBe(true);
  });

  test('two primary items means a double-bell movement', () => {
    const [candidate] = toCandidates([row({ '# Primary Items': 2 })]);
    expect(candidate.supports_doubles).toBe(true);
  });

  test('a null unilateral flag reads as bilateral', () => {
    const [candidate] = toCandidates([row({ unilateral_lower: null })]);
    expect(candidate.unilateral_lower).toBe(false);
  });

  test('credits are filtered to known patterns and null when none remain', () => {
    const [odd, none] = toCandidates([
      row({ id: 'a', Movement: 'A', pattern_credits: ['hinge', 'mystery'] }),
      row({ id: 'b', Movement: 'B', pattern_credits: [] }),
    ]);
    expect(odd.pattern_credits).toEqual(['hinge']);
    expect(none.pattern_credits).toBeNull();
  });

  test('candidates come out in name order regardless of row order', () => {
    const names = toCandidates([
      row({ id: '1', Movement: 'Snatch' }),
      row({ id: '2', Movement: 'Clean' }),
      row({ id: '3', Movement: 'Press' }),
    ]).map((c) => c.name);
    expect(names).toEqual(['Clean', 'Press', 'Snatch']);
  });
});

describe('applySkillCeiling — movements beyond the frontier are dropped', () => {
  const candidate = (movement_id: string, skill_node_id: string | null) =>
    toCandidates([row({ id: movement_id, Movement: movement_id, skill_node_id })])[0];

  const candidates = [
    candidate('deadbug', 'L1-N4'),
    candidate('swing', 'L2-N2'),
    candidate('deadlift', 'L2-N1'),
    candidate('row', null),
    candidate('snatch', 'L8-N1'),
    candidate('stale', 'L0-N9'),
  ];

  const beginner = summarizeSkillTree([
    { nodeId: 'L1-N1', status: 'complete', completedAt: '2026-09-01T00:00:00Z' },
    { nodeId: 'L2-N2', status: 'active', completedAt: null },
  ]);

  test('is the identity without a summary', () => {
    expect(applySkillCeiling(candidates, null)).toBe(candidates);
  });

  test('keeps passed, practising, ready, unmapped and unknown nodes, in order', () => {
    expect(applySkillCeiling(candidates, beginner).map((c) => c.movement_id)).toEqual([
      'deadbug',
      'swing',
      'deadlift',
      'row',
      'stale',
    ]);
  });
});
