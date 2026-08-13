import { summarizeEquipment } from '../../../src/utils/equipment.ts';
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

  test.each([[-1], [2.5], [101]])(
    'a rung of %p is rejected',
    (rung: number) => {
      expect(reasonsFor(rec([{ rep_scheme: [5, rung] }])).join(' ')).toContain(
        'invalid rep counts',
      );
    },
  );

  // 0 is the max-rung sentinel now, so it passes the shared rules rather than
  // triggering a corrective retry.
  test('a rung of 0 is accepted as max', () => {
    expect(() => pass(rec([{ rep_scheme: [5, 0] }]))).not.toThrow();
  });

  test('an implausible weight is a warning, not a retry', () => {
    expect(() => pass(rec([{ weight_kg: 150 }]))).not.toThrow();
  });
});

describe('validateRecommendation — equipment', () => {
  const owned = summarizeEquipment([
    {
      kind: 'fixed',
      weight: 16,
      minWeight: null,
      maxWeight: null,
      stepWeight: null,
      unit: 'kilograms',
      quantity: 2,
    },
    {
      kind: 'adjustable',
      weight: null,
      minWeight: 12,
      maxWeight: 32,
      stepWeight: 2,
      unit: 'kilograms',
      quantity: 1,
    },
  ]);

  test('skips the check entirely when no equipment is recorded', () => {
    const r = rec([{ weight_kg: 27.5 }]);
    expect(() =>
      validateRecommendation(r, idsOf(r), undefined, null),
    ).not.toThrow();
  });

  test('accepts a session that keeps the adjustable bell at one setting', () => {
    const r = { ...rec([{ weight_kg: 16 }, { weight_kg: 28 }]), adjustable_settings_kg: [28] };
    expect(() =>
      validateRecommendation(r, idsOf(r), undefined, owned),
    ).not.toThrow();
  });

  test('rejects a session that re-plates the adjustable bell mid-workout', () => {
    // 12kg and 28kg are both settings of the one adjustable bell, but reaching
    // both in one session means changing it between blocks.
    const r = {
      ...rec([{ weight_kg: 12 }, { weight_kg: 28 }]),
      adjustable_settings_kg: [12, 28],
    };

    try {
      validateRecommendation(r, idsOf(r), undefined, owned);
      throw new Error('expected ValidationError');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).reasons).toEqual([
        'the session sets 2 adjustable weights but the lifter owns only 1 adjustable bell(s) — each bell holds one setting for the whole session',
      ]);
    }
  });

  test('rejects an undeclared adjustable weight', () => {
    const r = { ...rec([{ weight_kg: 24 }]), adjustable_settings_kg: [] };

    try {
      validateRecommendation(r, idsOf(r), undefined, owned);
      throw new Error('expected ValidationError');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).reasons[0]).toContain(
        'only reachable by re-plating an adjustable bell mid-session',
      );
    }
  });
});

describe('validateRecommendation — bell count', () => {
  const pairOf16 = summarizeEquipment([
    {
      kind: 'fixed',
      weight: 16,
      minWeight: null,
      maxWeight: null,
      stepWeight: null,
      unit: 'kilograms',
      quantity: 2,
    },
    {
      kind: 'fixed',
      weight: 24,
      minWeight: null,
      maxWeight: null,
      stepWeight: null,
      unit: 'kilograms',
      quantity: 1,
    },
  ]);

  test('rejects a bell count outside 1–2', () => {
    const r = rec([{ bells: 3 }]);
    try {
      validateRecommendation(r, idsOf(r));
      throw new Error('expected ValidationError');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).reasons[0]).toContain(
        'claims 3 bells — use 1 or 2',
      );
    }
  });

  test('rejects a double on a movement the catalog says is single-bell', () => {
    const r = rec([{ user_movement_id: 'goblet', bells: 2 }]);
    try {
      validateRecommendation(
        r,
        idsOf(r),
        undefined,
        null,
        new Map([['goblet', false]]),
      );
      throw new Error('expected ValidationError');
    } catch (err) {
      expect((err as ValidationError).reasons[0]).toContain(
        'not a double-bell movement',
      );
    }
  });

  test('allows a double when the catalog does not know the movement', () => {
    const r = rec([{ user_movement_id: 'custom', bells: 2 }]);
    expect(() =>
      validateRecommendation(
        r,
        idsOf(r),
        undefined,
        null,
        new Map([['custom', null]]),
      ),
    ).not.toThrow();
  });

  test('rejects a double at a weight the lifter owns only one of', () => {
    const r = { ...rec([{ weight_kg: 24, bells: 2 }]), adjustable_settings_kg: [] };
    try {
      validateRecommendation(r, idsOf(r), undefined, pairOf16);
      throw new Error('expected ValidationError');
    } catch (err) {
      expect((err as ValidationError).reasons).toEqual([
        'double-bell work at 24kg needs 2 bells at that weight but the lifter has 1',
      ]);
    }
  });

  test('accepts a double at a weight the lifter owns a pair of', () => {
    const r = { ...rec([{ weight_kg: 16, bells: 2 }]), adjustable_settings_kg: [] };
    expect(() =>
      validateRecommendation(r, idsOf(r), undefined, pairOf16),
    ).not.toThrow();
  });
});
