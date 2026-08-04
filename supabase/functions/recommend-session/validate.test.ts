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

  test('existing id/weight/reps checks still run alongside coverage', () => {
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
