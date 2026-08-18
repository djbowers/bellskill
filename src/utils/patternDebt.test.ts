import {
  BALANCE_TARGET_LIMIT,
  EMPTY_TRACKS,
  type BalanceTargetPattern,
  MovementAggregate,
  OVERDUE_DAYS,
  TARGET_CADENCE_DAYS,
  type WorkTracks,
  attributeMovement,
  classifyBand,
  computeDebtScore,
  computeOverallBalance,
  computePatternBalance,
  selectBalanceTargets,
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
    expect(patterns.squat.daysSinceLastTrained).toBe(3);
  });

  test('days-since is a calendar-day count, not raw elapsed hours', () => {
    // Trained yesterday evening; "now" is this morning, less than 24h later.
    const now = new Date(2026, 5, 24, 8, 0, 0);
    const trainedYesterdayEvening = new Date(2026, 5, 23, 20, 0, 0).toISOString();
    const { patterns } = computePatternBalance(
      [mov({ pattern_credits: ['pull'], last_trained_at: trainedYesterdayEvening })],
      now,
    );
    expect(patterns.pull.daysSinceLastTrained).toBe(1);
  });
});

describe('computeDebtScore — bodyweight & timed work tracks', () => {
  const tracks = (over: Partial<WorkTracks>): WorkTracks => ({
    ...EMPTY_TRACKS,
    ...over,
  });

  test('empty tracks reduce to the kg-only formula (regression guard)', () => {
    expect(computeDebtScore(10, 500, 1000, EMPTY_TRACKS)).toBe(63);
    expect(computeDebtScore(2, 1000, 1000, EMPTY_TRACKS)).toBe(9);
  });

  test('bodyweight-only pattern scores on its rep baseline, not pinned', () => {
    // 10 days ago, half of rep baseline -> same 63 as the kg worked example.
    expect(
      computeDebtScore(
        10,
        0,
        null,
        tracks({ recentUnloadedReps: 200, baselineUnloadedReps: 400 }),
      ),
    ).toBe(63);
    // Trained 2 days ago at rep baseline -> green, not permanently "Due".
    expect(
      computeDebtScore(
        2,
        0,
        null,
        tracks({ recentUnloadedReps: 400, baselineUnloadedReps: 400 }),
      ),
    ).toBe(9);
  });

  test('timed-only pattern scores on its seconds baseline', () => {
    expect(
      computeDebtScore(
        2,
        0,
        null,
        tracks({ recentSeconds: 60, baselineSeconds: 120 }),
      ),
    ).toBe(29); // 0.6×(2/14) + 0.4×0.5
  });

  test('mixed kg + reps: deficit is the mean of active tracks', () => {
    expect(
      computeDebtScore(
        0,
        500,
        1000,
        tracks({ recentUnloadedReps: 200, baselineUnloadedReps: 200 }),
      ),
    ).toBe(10); // deficits 0.5 (kg) and 0 (reps) -> mean 0.25
  });

  test('new-but-active bodyweight pattern gets grace (deficit 0)', () => {
    expect(
      computeDebtScore(7, 0, null, tracks({ recentUnloadedReps: 50 })),
    ).toBe(30); // recency only, same as the kg new-but-active case
  });
});

describe('computePatternBalance — bodyweight & timed rows', () => {
  test('push-up-only push pattern burns down like weighted work', () => {
    const { patterns } = computePatternBalance(
      [
        mov({
          movement_name: 'Push-Up',
          pattern_credits: ['push'],
          last_trained_at: daysAgo(10),
          total_reps: 200,
          total_unloaded_reps: 200,
          baseline_unloaded_reps: 400,
        }),
      ],
      NOW,
    );
    expect(patterns.push.debtScore).toBe(63);
    expect(patterns.push.band).toBe('yellow');
    expect(patterns.push.tracks.recentUnloadedReps).toBe(200);
    expect(patterns.push.tracks.baselineUnloadedReps).toBe(400);
  });

  test('timed carry contributes seconds instead of staying recency-only', () => {
    const { patterns } = computePatternBalance(
      [
        mov({
          movement_name: 'Suitcase Carry',
          pattern_credits: ['carry'],
          last_trained_at: daysAgo(2),
          total_seconds: 60,
          baseline_seconds: 120,
        }),
      ],
      NOW,
    );
    expect(patterns.carry.debtScore).toBe(29);
    expect(patterns.carry.tracks.recentSeconds).toBe(60);
    expect(patterns.carry.tracks.baselineSeconds).toBe(120);
  });

  test('rows without track fields (pre-migration) behave as before', () => {
    const { patterns } = computePatternBalance(
      [
        mov({
          pattern_credits: ['hinge'],
          last_trained_at: daysAgo(10),
          total_volume_kg: 500,
          baseline_volume_kg: 1000,
        }),
      ],
      NOW,
    );
    expect(patterns.hinge.debtScore).toBe(63);
  });
});

describe('selectBalanceTargets', () => {
  const scored = (
    pattern: BalanceTargetPattern['pattern'],
    debtScore: number,
    over: Partial<BalanceTargetPattern> = {},
  ): BalanceTargetPattern => ({
    pattern,
    debtScore,
    band: debtScore >= 66 ? 'red' : debtScore >= 33 ? 'yellow' : 'green',
    isNew: false,
    ...over,
  });

  const allCredits = [['hinge', 'squat', 'push', 'pull', 'carry', 'rotation', 'core', 'get_up']];

  test('caps at BALANCE_TARGET_LIMIT highest-debt red patterns', () => {
    const targets = selectBalanceTargets(
      [
        scored('hinge', 90),
        scored('squat', 80),
        scored('push', 70),
        scored('pull', 68),
        scored('carry', 20),
      ],
      allCredits,
    );
    expect(targets).toEqual(['hinge', 'squat', 'push']);
    expect(targets).toHaveLength(BALANCE_TARGET_LIMIT);
  });

  test('ties break on canonical PATTERNS order', () => {
    const targets = selectBalanceTargets(
      [scored('core', 90), scored('hinge', 90), scored('pull', 90), scored('squat', 90)],
      allCredits,
    );
    expect(targets).toEqual(['hinge', 'squat', 'pull']);
  });

  test('excludes yellow and green bands', () => {
    expect(
      selectBalanceTargets([scored('hinge', 65), scored('squat', 30)], allCredits),
    ).toEqual([]);
  });

  test('excludes New patterns even when red-scored', () => {
    expect(
      selectBalanceTargets([scored('carry', 100, { isNew: true })], allCredits),
    ).toEqual([]);
  });

  test('excludes patterns no candidate can cover', () => {
    const targets = selectBalanceTargets(
      [scored('hinge', 90), scored('carry', 100)],
      [['hinge'], null],
    );
    expect(targets).toEqual(['hinge']);
  });

  test('returns fewer than the cap when fewer qualify', () => {
    expect(
      selectBalanceTargets([scored('rotation', 70)], allCredits),
    ).toEqual(['rotation']);
  });

  test('empty inputs yield empty targets', () => {
    expect(selectBalanceTargets([], [])).toEqual([]);
  });
});
