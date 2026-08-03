import {
  MovementAggregate,
  OVERDUE_DAYS,
  TARGET_CADENCE_DAYS,
  attributeMovement,
  classifyBand,
  computeDebtScore,
  computeOverallBalance,
  computePatternBalance,
} from './patternDebt';

const NOW = new Date('2026-06-24T12:00:00Z');
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const mov = (over: Partial<MovementAggregate>): MovementAggregate => ({
  movement_id: 'm1',
  movement_name: 'Movement',
  pattern_credits: null,
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
    expect(computeDebtScore(7, 800, null)).toBe(30);
  });

  test('volume above baseline clamps deficit at 0', () => {
    expect(computeDebtScore(0, 2000, 1000)).toBe(0);
  });

  test('recency saturates at OVERDUE_DAYS', () => {
    expect(computeDebtScore(28, 1000, 1000)).toBe(computeDebtScore(14, 1000, 1000));
  });
});

describe('OVERDUE_DAYS', () => {
  test('derives from TARGET_CADENCE_DAYS', () => {
    expect(OVERDUE_DAYS).toBe(2 * TARGET_CADENCE_DAYS);
  });
});

describe('attributeMovement', () => {
  test('explicit credits win, filtering unknown strings', () => {
    expect(attributeMovement(['get_up', 'push', 'rotation'], 'anything')).toEqual([
      'get_up',
      'push',
      'rotation',
    ]);
    expect(attributeMovement(['push', 'bogus'], 'anything')).toEqual(['push']);
  });

  test('null credits + get-up-like name -> get_up', () => {
    expect(attributeMovement(null, 'Turkish Get-Up')).toEqual(['get_up']);
    expect(attributeMovement(null, 'get up')).toEqual(['get_up']);
    expect(attributeMovement(null, 'Getup')).toEqual(['get_up']);
    expect(attributeMovement(null, 'KB TURKISH sit press')).toEqual(['get_up']);
  });

  test('null credits + non-get-up name -> []', () => {
    expect(attributeMovement(null, 'Goblet Squat')).toEqual([]);
  });

  test('empty array credits + non-get-up name -> []', () => {
    expect(attributeMovement([], 'Goblet Squat')).toEqual([]);
  });
});

describe('computeOverallBalance', () => {
  test('empty -> balanced', () => {
    expect(computeOverallBalance([])).toBe('balanced');
  });
});

describe('computePatternBalance', () => {
  test('returns all eight patterns with no data, every one isNew, balanced', () => {
    const { patterns, overallBalance } = computePatternBalance([], NOW);
    expect(Object.keys(patterns).sort()).toEqual(
      ['carry', 'core', 'get_up', 'hinge', 'pull', 'push', 'rotation', 'squat'].sort(),
    );
    expect(Object.values(patterns).every((p) => p.isNew)).toBe(true);
    expect(overallBalance).toBe('balanced');
  });

  test('TGU row credits get_up/push/rotation each with full volume (worked example 4)', () => {
    const { patterns } = computePatternBalance(
      [
        mov({
          movement_name: 'Turkish Get-Up',
          pattern_credits: ['get_up', 'push', 'rotation'],
          last_trained_at: daysAgo(2),
          total_volume_kg: 1000,
          baseline_volume_kg: 1000,
        }),
      ],
      NOW,
    );
    for (const p of ['get_up', 'push', 'rotation'] as const) {
      expect(patterns[p].debtScore).toBe(9);
      expect(patterns[p].band).toBe('green');
      expect(patterns[p].recentVolume).toBe(1000);
    }
  });

  test('two rows crediting the same pattern sum their recentVolume', () => {
    const { patterns } = computePatternBalance(
      [
        mov({
          movement_name: 'Push-Up',
          pattern_credits: ['push'],
          last_trained_at: daysAgo(3),
          total_volume_kg: 200,
          baseline_volume_kg: 150,
        }),
        mov({
          movement_name: 'Kettlebell Press',
          pattern_credits: ['push'],
          last_trained_at: daysAgo(1),
          total_volume_kg: 300,
          baseline_volume_kg: 250,
        }),
      ],
      NOW,
    );
    expect(patterns.push.recentVolume).toBe(500);
    expect(patterns.push.baselineVolume).toBe(400);
  });

  test('duplicate credits on one row (pattern_credits: [push, push]) count volume once', () => {
    const { patterns } = computePatternBalance(
      [
        mov({
          movement_name: 'Push-Up',
          pattern_credits: ['push', 'push'],
          last_trained_at: daysAgo(1),
          total_volume_kg: 200,
          baseline_volume_kg: 150,
        }),
      ],
      NOW,
    );
    expect(patterns.push.recentVolume).toBe(200);
    expect(patterns.push.baselineVolume).toBe(150);
  });

  test('single-pattern user: other patterns isNew and excluded -> balanced', () => {
    const { patterns, overallBalance } = computePatternBalance(
      [
        mov({
          pattern_credits: ['hinge'],
          last_trained_at: daysAgo(1),
          total_volume_kg: 1200,
          baseline_volume_kg: 1000,
        }),
      ],
      NOW,
    );
    expect(patterns.hinge.band).toBe('green');
    expect(patterns.hinge.isNew).toBe(false);
    expect(patterns.pull.isNew).toBe(true);
    expect(overallBalance).toBe('balanced');
  });

  test('adding old pull history flips overall balance to hinge-heavy', () => {
    const { patterns, overallBalance } = computePatternBalance(
      [
        mov({
          pattern_credits: ['hinge'],
          last_trained_at: daysAgo(1),
          total_volume_kg: 1200,
          baseline_volume_kg: 1000,
        }),
        mov({
          pattern_credits: ['pull'],
          last_trained_at: null,
          baseline_volume_kg: 500,
        }),
      ],
      NOW,
    );
    expect(patterns.pull.isNew).toBe(false);
    expect(patterns.pull.debtScore).toBe(100);
    expect(patterns.pull.band).toBe('red');
    expect(overallBalance).toBe('hinge-heavy');
  });

  test('isNew semantics: null last_trained_at + non-null baseline is NOT new', () => {
    const { patterns } = computePatternBalance(
      [mov({ pattern_credits: ['squat'], last_trained_at: null, baseline_volume_kg: 500 })],
      NOW,
    );
    expect(patterns.squat.isNew).toBe(false);
    expect(patterns.squat.band).toBe('red');
    expect(patterns.carry.isNew).toBe(true);
  });

  test('enabledPatterns scopes both the record and the balance', () => {
    const { patterns, overallBalance } = computePatternBalance(
      [
        mov({
          pattern_credits: ['hinge'],
          last_trained_at: daysAgo(1),
          total_volume_kg: 1200,
          baseline_volume_kg: 1000,
        }),
        mov({
          pattern_credits: ['pull'],
          last_trained_at: null,
          baseline_volume_kg: 500,
        }),
      ],
      NOW,
      ['hinge', 'pull'],
    );
    expect(Object.keys(patterns).sort()).toEqual(['hinge', 'pull']);
    expect(overallBalance).toBe('hinge-heavy');
  });

  test('hardest_rpe: max effort wins across rows crediting the same pattern', () => {
    const { patterns } = computePatternBalance(
      [
        mov({ pattern_credits: ['push'], hardest_rpe: 'easy' }),
        mov({ pattern_credits: ['push'], hardest_rpe: 'maxEffort' }),
      ],
      NOW,
    );
    expect(patterns.push.hardestRpe).toBe('maxEffort');
    expect(patterns.carry.hardestRpe).toBeNull();
  });

  test('maps last_trained_at into a Date and days-since', () => {
    const { patterns } = computePatternBalance(
      [mov({ pattern_credits: ['squat'], last_trained_at: daysAgo(3), total_volume_kg: 500 })],
      NOW,
    );
    expect(patterns.squat.lastTrained).toBeInstanceOf(Date);
    expect(patterns.squat.daysSinceLastTrained).toBeCloseTo(3, 5);
  });
});
