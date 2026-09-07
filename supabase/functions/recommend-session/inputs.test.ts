import { type CatalogRow, toCandidates } from './inputs.ts';

const row = (over: Partial<CatalogRow> = {}): CatalogRow => ({
  id: 'id-swing',
  Movement: 'Kettlebell Swing',
  pattern_credits: ['hinge'],
  '# Primary Items': 1,
  unilateral_lower: false,
  ...over,
});

describe('toCandidates — catalog rows become the candidate set', () => {
  test('maps the catalog columns onto a candidate', () => {
    expect(toCandidates([row()])).toEqual([
      {
        movement_id: 'id-swing',
        name: 'Kettlebell Swing',
        pattern_credits: ['hinge'],
        supports_doubles: false,
        unilateral_lower: false,
      },
    ]);
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
