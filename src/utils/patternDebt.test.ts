import {
  PatternAggregate,
  classifyBand,
  computeDebtScore,
  computeOverallBalance,
  computePatternBalance,
} from './patternDebt';

const NOW = new Date('2026-06-24T12:00:00Z');
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const agg = (over: Partial<PatternAggregate>): PatternAggregate => ({
  pattern: 'hinge',
  last_trained_at: null,
  set_count: 0,
  total_reps: 0,
  total_volume_kg: 0,
  baseline_volume_kg: null,
  ...over,
});

describe('classifyBand', () => {
  test('thresholds', () => {
    expect(classifyBand(0)).toBe('green');
    expect(classifyBand(32)).toBe('green');
    expect(classifyBand(33)).toBe('yellow');
    expect(classifyBand(65)).toBe('yellow');
    expect(classifyBand(66)).toBe('red');
    expect(classifyBand(100)).toBe('red');
  });
});

describe('computeDebtScore — worked examples from the spec', () => {
  test('trained 2 days ago at baseline volume -> 9 (green)', () => {
    // recency 2/14, deficit 0
    expect(computeDebtScore(2, 1000, 1000)).toBe(9);
  });

  test('trained 10 days ago at half baseline -> 63 (yellow)', () => {
    expect(computeDebtScore(10, 500, 1000)).toBe(63);
  });

  test('never trained, no baseline -> 100 (red)', () => {
    expect(computeDebtScore(null, 0, null)).toBe(100);
  });
});

describe('computeDebtScore — edge cases', () => {
  test('new-but-active pattern (volume, no baseline) scored on recency only', () => {
    // recency 7/14 = 0.5, deficit neutralized to 0
    expect(computeDebtScore(7, 800, null)).toBe(30);
  });

  test('volume above baseline clamps deficit at 0', () => {
    expect(computeDebtScore(0, 2000, 1000)).toBe(0);
  });

  test('recency saturates at OVERDUE_DAYS', () => {
    expect(computeDebtScore(28, 1000, 1000)).toBe(computeDebtScore(14, 1000, 1000));
  });
});

describe('computeOverallBalance', () => {
  test('empty -> balanced', () => {
    expect(computeOverallBalance([])).toBe('balanced');
  });
});

describe('computePatternBalance', () => {
  test('always returns all seven patterns even with no data', () => {
    const { patterns } = computePatternBalance([], NOW);
    expect(Object.keys(patterns).sort()).toEqual(
      ['carry', 'get_up', 'hinge', 'pull', 'push', 'rotation', 'squat'].sort(),
    );
  });

  test('no history at all -> every pattern maxed and balanced', () => {
    const { patterns, overallBalance } = computePatternBalance([], NOW);
    expect(patterns.hinge.debtScore).toBe(100);
    expect(patterns.squat.band).toBe('red');
    expect(overallBalance).toBe('balanced');
  });

  test('single-pattern user -> that pattern is the skew', () => {
    const { patterns, overallBalance } = computePatternBalance(
      [
        agg({
          pattern: 'hinge',
          last_trained_at: daysAgo(1),
          total_volume_kg: 1200,
          baseline_volume_kg: 1000,
        }),
      ],
      NOW,
    );
    expect(patterns.hinge.band).toBe('green');
    expect(patterns.pull.debtScore).toBe(100);
    expect(overallBalance).toBe('hinge-heavy');
  });

  test('maps last_trained_at into a Date and days-since', () => {
    const { patterns } = computePatternBalance(
      [agg({ pattern: 'squat', last_trained_at: daysAgo(3), total_volume_kg: 500 })],
      NOW,
    );
    expect(patterns.squat.lastTrained).toBeInstanceOf(Date);
    expect(patterns.squat.daysSinceLastTrained).toBeCloseTo(3, 5);
  });

  test('passes hardest_rpe through untouched, defaulting to null', () => {
    const { patterns } = computePatternBalance(
      [agg({ pattern: 'push', hardest_rpe: 'maxEffort' })],
      NOW,
    );
    expect(patterns.push.hardestRpe).toBe('maxEffort');
    // Backfilled (untrained) patterns carry no rating.
    expect(patterns.carry.hardestRpe).toBeNull();
  });
});
