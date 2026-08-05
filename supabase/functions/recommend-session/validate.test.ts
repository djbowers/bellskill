import type { Recommendation } from './types.ts';
import { ValidationError, validateRecommendation } from './validate.ts';

const rec = (blocks: Array<Partial<Recommendation['blocks'][number]>>): Recommendation => ({
  rationale: 'test',
  duration_minutes: 20,
  format: 'Circuit',
  confidence: 'high',
  blocks: blocks.map((b, i) => ({
    user_movement_id: `um-${i}`,
    movement_name: `Movement ${i}`,
    weight_kg: 16,
    rep_scheme: [5, 5, 5],
    notes: '',
    ...b,
  })),
});

const idsOf = (r: Recommendation) => new Set(r.blocks.map((b) => b.user_movement_id));

describe('validateRecommendation — coverage invariant', () => {
  test('passes when block credits cover every target', () => {
    const r = rec([{ user_movement_id: 'tgu' }, { user_movement_id: 'swing' }]);
    expect(() =>
      validateRecommendation(r, idsOf(r), {
        targets: ['get_up', 'push', 'hinge'],
        creditsById: new Map([
          ['tgu', ['get_up', 'push', 'rotation']],
          ['swing', ['hinge']],
        ]),
      }),
    ).not.toThrow();
  });

  test('fails with a per-pattern reason for each uncovered target', () => {
    const r = rec([{ user_movement_id: 'swing' }]);
    try {
      validateRecommendation(r, idsOf(r), {
        targets: ['hinge', 'carry', 'pull'],
        creditsById: new Map([['swing', ['hinge']]]),
      });
      throw new Error('expected ValidationError');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const reasons = (err as ValidationError).reasons;
      expect(reasons).toHaveLength(2);
      expect(reasons[0]).toContain('"carry"');
      expect(reasons[1]).toContain('"pull"');
    }
  });

  test('empty targets is a no-op (default mode / degraded balance mode)', () => {
    const r = rec([{ user_movement_id: 'swing' }]);
    expect(() =>
      validateRecommendation(r, idsOf(r), {
        targets: [],
        creditsById: new Map([['swing', null]]),
      }),
    ).not.toThrow();
  });

  test('null credits on a chosen block cover nothing', () => {
    const r = rec([{ user_movement_id: 'custom' }]);
    expect(() =>
      validateRecommendation(r, idsOf(r), {
        targets: ['squat'],
        creditsById: new Map([['custom', null]]),
      }),
    ).toThrow(ValidationError);
  });

  test('id and runnability checks still run alongside coverage', () => {
    const r = rec([{ user_movement_id: 'rogue', weight_kg: -1 }]);
    try {
      validateRecommendation(r, new Set(['known']), {
        targets: ['squat'],
        creditsById: new Map(),
      });
      throw new Error('expected ValidationError');
    } catch (err) {
      const reasons = (err as ValidationError).reasons;
      expect(reasons.some((x) => x.includes('not in the candidate list'))).toBe(true);
      expect(reasons.some((x) => x.includes('non-positive weight'))).toBe(true);
      expect(reasons.some((x) => x.includes('"squat"'))).toBe(true);
    }
  });
});

// Runnability now comes from the shared verifier (src/utils/validateWorkout.ts),
// which owns the rule-by-rule unit tests. These cover the seam: that its errors
// reach `reasons` with enough context for the model to act on, and that its
// warnings never trigger a retry.
describe('validateRecommendation — shared runnability rules', () => {
  const pass = (r: Recommendation) =>
    validateRecommendation(r, idsOf(r));

  const reasonsFor = (r: Recommendation): string[] => {
    try {
      validateRecommendation(r, idsOf(r));
    } catch (err) {
      return (err as ValidationError).reasons;
    }
    throw new Error('expected ValidationError');
  };

  test('a sound recommendation passes', () => {
    expect(() => pass(rec([{}, {}]))).not.toThrow();
  });

  test('the 2026-08-04 bug is now caught: 4/3/3 rungs in a Circuit', () => {
    const reasons = reasonsFor(
      rec([
        { rep_scheme: [1, 2, 3, 4] },
        { rep_scheme: [5, 5, 5] },
        { rep_scheme: [5, 5, 5] },
      ]),
    );
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('Rep schemes differ across movements');
  });

  test('the same rungs declared as Straight Sets pass', () => {
    const r: Recommendation = {
      ...rec([{ rep_scheme: [1, 2, 3, 4] }, { rep_scheme: [5, 5, 5] }]),
      format: 'Straight Sets',
    };
    expect(() => validateRecommendation(r, idsOf(r))).not.toThrow();
  });

  test('a zero duration is rejected', () => {
    const r: Recommendation = { ...rec([{}]), duration_minutes: 0 };
    expect(reasonsFor(r).join(' ')).toContain('goal greater than zero');
  });

  test('reasons name the offending block', () => {
    const reasons = reasonsFor(rec([{}, { rep_scheme: [], movement_name: 'Snatch' }]));
    expect(reasons.some((x) => x.includes('block 2 (Snatch)'))).toBe(true);
  });

  test('an empty session reports against the session, not a block', () => {
    expect(reasonsFor(rec([])).join(' ')).toContain('the session');
  });

  test.each([[0], [-1], [2.5], [101]])(
    'a rung of %p is rejected',
    (rung: number) => {
      expect(reasonsFor(rec([{ rep_scheme: [5, rung] }])).join(' ')).toContain(
        'invalid rep counts',
      );
    },
  );

  test('an implausible weight is a warning, not a retry', () => {
    expect(() => pass(rec([{ weight_kg: 150 }]))).not.toThrow();
  });
});
