import { GhostSession, WorkoutGoalUnits } from '~/types';

/**
 * Cumulative times at which the ghost had completed 0, 1, 2 … rounds.
 *
 * Index is the round count, value is the elapsed time it was reached — so
 * `boundaries[0]` is always 0 and `boundaries[n]` is when round n finished.
 * Recorded splits are used as-is; a log from before splits were captured is
 * spread evenly across its total duration, which is the only honest guess
 * available from a start time, an end time, and a round count.
 */
const getRoundBoundaries = ({
  splits,
  totalRounds,
  totalDurationMs,
}: GhostSession): number[] => {
  if (splits.length > 0) {
    const ordered = [...splits].sort((a, b) => a.roundIndex - b.roundIndex);
    return [0, ...ordered.map((split) => split.elapsedMs)];
  }

  if (totalRounds <= 0) return [0];

  const perRound = totalDurationMs / totalRounds;
  return Array.from(
    { length: totalRounds + 1 },
    (_, round) => round * perRound,
  );
};

/** Rounds the ghost had finished by `elapsedMs`, fractional mid-round. */
export const getGhostRoundsAt = (
  ghost: GhostSession,
  elapsedMs: number,
): number => {
  const boundaries = getRoundBoundaries(ghost);
  const finalRound = boundaries.length - 1;

  if (finalRound <= 0 || elapsedMs <= 0) return 0;
  // Past its last round the ghost has nowhere left to go — it finished.
  if (elapsedMs >= boundaries[finalRound]) return finalRound;

  const nextRound = boundaries.findIndex((boundary) => boundary > elapsedMs);
  const spanStart = boundaries[nextRound - 1];
  const spanMs = boundaries[nextRound] - spanStart;

  // Two rounds sharing a timestamp would divide by zero. Treat the pair as
  // already crossed rather than emitting Infinity into the rail geometry.
  if (spanMs <= 0) return nextRound;

  return nextRound - 1 + (elapsedMs - spanStart) / spanMs;
};

/**
 * How much slower this round was than the ghost's same round, in ms. Negative
 * is faster. Null when the ghost never reached that round, which is what
 * happens once you have overtaken it for good.
 */
export const getLapDelta = (
  ghost: GhostSession,
  roundIndex: number,
  yourLapMs: number,
): number | null => {
  const boundaries = getRoundBoundaries(ghost);
  if (roundIndex < 0 || roundIndex + 1 > boundaries.length - 1) return null;

  const ghostLapMs = boundaries[roundIndex + 1] - boundaries[roundIndex];
  return yourLapMs - ghostLapMs;
};

/**
 * Ticks on the rail — the round count this session is racing to.
 *
 * A rounds goal prescribes one directly. Time and volume goals prescribe no
 * round count at all, so the ghost's own total stands in: the rail becomes a
 * race to beat last session's rounds, which is the more useful framing anyway.
 */
export const getRailScale = ({
  workoutGoal,
  workoutGoalUnits,
  ghost,
}: {
  workoutGoal: number;
  workoutGoalUnits: WorkoutGoalUnits;
  ghost: GhostSession;
}): number => {
  const scale =
    workoutGoalUnits === 'rounds' && workoutGoal > 0
      ? workoutGoal
      : ghost.totalRounds;

  return Math.max(1, scale);
};

/** Signed, rounded to the second: `−4s`, `+1:07`, `even`. */
export const formatLapDelta = (deltaMs: number): string => {
  const totalSeconds = Math.round(Math.abs(deltaMs) / 1000);
  if (totalSeconds === 0) return 'even';

  const sign = deltaMs < 0 ? '−' : '+';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0
    ? `${sign}${minutes}:${String(seconds).padStart(2, '0')}`
    : `${sign}${totalSeconds}s`;
};
