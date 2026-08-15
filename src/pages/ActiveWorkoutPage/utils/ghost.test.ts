import { describe, expect, it } from 'vitest';

import { GhostSession, RoundSplit } from '~/types';

import {
  formatLapDelta,
  getGhostRoundsAt,
  getLapDelta,
  getRailScale,
} from './ghost';

const buildGhost = (overrides: Partial<GhostSession> = {}): GhostSession => ({
  workoutLogId: 1,
  completedAt: new Date('2026-08-12T10:00:00Z'),
  totalRounds: 4,
  totalDurationMs: 400_000,
  splits: [],
  ...overrides,
});

/** Uneven on purpose: a ghost that paced evenly can't catch interpolation bugs. */
const unevenSplits: RoundSplit[] = [
  { roundIndex: 0, elapsedMs: 60_000 },
  { roundIndex: 1, elapsedMs: 160_000 },
  { roundIndex: 2, elapsedMs: 200_000 },
  { roundIndex: 3, elapsedMs: 400_000 },
];

describe('getGhostRoundsAt', () => {
  describe('with recorded splits', () => {
    const ghost = buildGhost({ splits: unevenSplits });

    it('has completed nothing at the start', () => {
      expect(getGhostRoundsAt(ghost, 0)).toBe(0);
    });

    it('lands exactly on a round at its recorded split', () => {
      expect(getGhostRoundsAt(ghost, 60_000)).toBe(1);
      expect(getGhostRoundsAt(ghost, 200_000)).toBe(3);
    });

    it('interpolates mid-round', () => {
      // Halfway through round 2, which ran 60s -> 160s.
      expect(getGhostRoundsAt(ghost, 110_000)).toBe(1.5);
    });

    it('follows the real shape rather than an average pace', () => {
      // A fast third round (40s) puts the ghost further along at 180s than a
      // flat 100s-per-round average would.
      expect(getGhostRoundsAt(ghost, 180_000)).toBe(2.5);
    });

    it('stops at its final round once it has finished', () => {
      expect(getGhostRoundsAt(ghost, 400_000)).toBe(4);
      expect(getGhostRoundsAt(ghost, 999_000)).toBe(4);
    });

    it('reads splits in round order even when they arrive shuffled', () => {
      const shuffled = buildGhost({ splits: [...unevenSplits].reverse() });
      expect(getGhostRoundsAt(shuffled, 110_000)).toBe(1.5);
    });

    it('does not divide by zero when two rounds share a timestamp', () => {
      const tied = buildGhost({
        splits: [
          { roundIndex: 0, elapsedMs: 60_000 },
          { roundIndex: 1, elapsedMs: 60_000 },
          { roundIndex: 2, elapsedMs: 120_000 },
        ],
      });
      expect(Number.isFinite(getGhostRoundsAt(tied, 60_000))).toBe(true);
      expect(getGhostRoundsAt(tied, 90_000)).toBe(2.5);
    });
  });

  describe('without splits, falling back to derived pace', () => {
    const ghost = buildGhost({ totalRounds: 4, totalDurationMs: 400_000 });

    it('spreads rounds evenly across the duration', () => {
      expect(getGhostRoundsAt(ghost, 100_000)).toBe(1);
      expect(getGhostRoundsAt(ghost, 250_000)).toBe(2.5);
    });

    it('stops at its final round', () => {
      expect(getGhostRoundsAt(ghost, 400_000)).toBe(4);
      expect(getGhostRoundsAt(ghost, 500_000)).toBe(4);
    });

    it('returns zero for a ghost that completed no rounds', () => {
      const empty = buildGhost({ totalRounds: 0, totalDurationMs: 60_000 });
      expect(getGhostRoundsAt(empty, 30_000)).toBe(0);
    });
  });

  it('never goes negative on a clock that has not started', () => {
    expect(getGhostRoundsAt(buildGhost({ splits: unevenSplits }), -5_000)).toBe(
      0,
    );
  });
});

describe('getLapDelta', () => {
  const ghost = buildGhost({ splits: unevenSplits });

  it('is negative when the round was faster than the ghost', () => {
    // Ghost's round 1 took 60s; 52s is 8s quicker.
    expect(getLapDelta(ghost, 0, 52_000)).toBe(-8_000);
  });

  it('is positive when the round was slower', () => {
    // Ghost's round 2 took 100s (60s -> 160s).
    expect(getLapDelta(ghost, 1, 118_000)).toBe(18_000);
  });

  it('compares against that round only, not the average', () => {
    // Round 3 was the ghost's quick one at 40s, so matching the average is slow.
    expect(getLapDelta(ghost, 2, 100_000)).toBe(60_000);
  });

  it('returns null once you have outlasted the ghost', () => {
    expect(getLapDelta(ghost, 4, 90_000)).toBeNull();
  });

  it('returns null for a negative round index', () => {
    expect(getLapDelta(ghost, -1, 90_000)).toBeNull();
  });

  it('uses the derived pace when the ghost has no splits', () => {
    const derived = buildGhost({ totalRounds: 4, totalDurationMs: 400_000 });
    expect(getLapDelta(derived, 0, 90_000)).toBe(-10_000);
    expect(getLapDelta(derived, 3, 110_000)).toBe(10_000);
  });

  it('returns null for a splitless ghost that completed no rounds', () => {
    const empty = buildGhost({ totalRounds: 0, totalDurationMs: 60_000 });
    expect(getLapDelta(empty, 0, 60_000)).toBeNull();
  });
});

describe('getRailScale', () => {
  const ghost = buildGhost({ totalRounds: 7 });

  it('uses the prescribed round count for a rounds goal', () => {
    expect(
      getRailScale({ workoutGoal: 10, workoutGoalUnits: 'rounds', ghost }),
    ).toBe(10);
  });

  it("falls back to the ghost's rounds for a time goal", () => {
    expect(
      getRailScale({ workoutGoal: 20, workoutGoalUnits: 'minutes', ghost }),
    ).toBe(7);
  });

  it("falls back to the ghost's rounds for a volume goal", () => {
    expect(
      getRailScale({ workoutGoal: 2000, workoutGoalUnits: 'kilograms', ghost }),
    ).toBe(7);
  });

  it('scales to the ghost when a rounds goal is unset', () => {
    expect(
      getRailScale({ workoutGoal: 0, workoutGoalUnits: 'rounds', ghost }),
    ).toBe(7);
  });

  it('never returns a scale below one', () => {
    const empty = buildGhost({ totalRounds: 0 });
    expect(
      getRailScale({
        workoutGoal: 0,
        workoutGoalUnits: 'minutes',
        ghost: empty,
      }),
    ).toBe(1);
  });

  it('keeps a goal that outruns the ghost, so the rail shows the real target', () => {
    expect(
      getRailScale({ workoutGoal: 12, workoutGoalUnits: 'rounds', ghost }),
    ).toBe(12);
  });
});

describe('formatLapDelta', () => {
  it('marks a faster round with a minus', () => {
    expect(formatLapDelta(-4_000)).toBe('−4s');
  });

  it('marks a slower round with a plus', () => {
    expect(formatLapDelta(12_000)).toBe('+12s');
  });

  it('switches to m:ss past a minute', () => {
    expect(formatLapDelta(67_000)).toBe('+1:07');
    expect(formatLapDelta(-125_000)).toBe('−2:05');
  });

  it('says even rather than a signed zero', () => {
    expect(formatLapDelta(0)).toBe('even');
    expect(formatLapDelta(-400)).toBe('even');
  });

  it('rounds to the nearest second', () => {
    expect(formatLapDelta(-4_600)).toBe('−5s');
  });
});
