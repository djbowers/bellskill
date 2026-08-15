import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { GhostSession } from '~/types';

import { getGhostRoundsAt } from '../utils';

/** Past this many rounds the ticks stop reading as marks and start reading as noise. */
const MAX_TICKS = 20;

interface GhostRailProps {
  ghost: GhostSession;
  /** Ticks on the rail — the round count being raced to. */
  totalRounds: number;
  /** Your position. */
  completedRounds: number;
  startedAt: Date;
}

/**
 * The ghost car: a full-height rail marking every round of the session.
 *
 * The solid fill is you, the hollow ring is where your last run had got to at
 * this same point on the clock. The gap between them is the whole message, and
 * it reads without focus — the point is to catch it in peripheral vision
 * mid-swing, not to be studied.
 *
 * State is carried three ways over, so no one channel has to work alone:
 * position (ring above or below the fill), colour, and the screen-reader line.
 * Behind uses `status-warning`, never `destructive` — falling off last week's
 * pace is information, not an error.
 */
export const GhostRail = ({
  ghost,
  totalRounds,
  completedRounds,
  startedAt,
}: GhostRailProps) => {
  // The ghost moves on the clock, so it needs its own tick. Kept here rather
  // than on the page so a moving ghost re-renders a rail, not a whole workout.
  const [ghostRounds, setGhostRounds] = useState(() =>
    getGhostRoundsAt(ghost, Date.now() - startedAt.getTime()),
  );

  useEffect(
    function advanceGhost() {
      const timer = setInterval(() => {
        setGhostRounds(
          getGhostRoundsAt(ghost, Date.now() - startedAt.getTime()),
        );
      }, 1000);

      return () => clearInterval(timer);
    },
    [ghost, startedAt],
  );

  const toPercent = (rounds: number) =>
    Math.min(100, Math.max(0, (rounds / totalRounds) * 100));

  const yourPercent = toPercent(completedRounds);
  const ghostPercent = toPercent(ghostRounds);
  const roundsAhead = completedRounds - ghostRounds;
  const isAhead = roundsAhead >= 0;

  return (
    <>
      {/* Ambient edge tint. Deliberately weak: a screen-wide wash at any real
          strength reads as an error state rather than as pace. */}
      <div
        aria-hidden
        className={clsx(
          'pointer-events-none absolute inset-y-0 left-0 w-5 opacity-20',
          isAhead
            ? 'bg-gradient-to-r from-status-success to-transparent'
            : 'bg-gradient-to-r from-status-warning to-transparent',
        )}
      />

      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 overflow-hidden rounded-full bg-accent"
        data-testid="ghost-rail"
      >
        {Array.from({ length: totalRounds <= MAX_TICKS ? totalRounds - 1 : 0 })
          .map((_, index) => (index + 1) / totalRounds)
          .map((fraction) => (
            <div
              key={fraction}
              className="absolute inset-x-0 h-px bg-background opacity-60"
              style={{ top: `${fraction * 100}%` }}
            />
          ))}

        <div
          className={clsx(
            'absolute inset-x-0 top-0 rounded-full motion-safe:transition-[height] motion-safe:duration-500',
            isAhead ? 'bg-status-success' : 'bg-status-warning',
          )}
          style={{ height: `${yourPercent}%` }}
          data-testid="ghost-rail-you"
        />
      </div>

      {/* Outside the track: the track clips its fill to a rounded shape, which
          would also slice the ghost marker in half at either end of the rail —
          exactly where it matters, since that is a ghost about to be caught or
          one that has run away. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1"
      >
        <div
          className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground bg-background motion-safe:transition-[top] motion-safe:duration-500"
          style={{ top: `${ghostPercent}%` }}
          data-testid="ghost-rail-ghost"
        />
      </div>

      <span className="sr-only" role="status">
        {isAhead
          ? `Ahead of last session by ${formatRounds(roundsAhead)}`
          : `Behind last session by ${formatRounds(-roundsAhead)}`}
      </span>
    </>
  );
};

const formatRounds = (rounds: number) => {
  const rounded = Math.round(rounds * 10) / 10;
  return rounded === 1 ? '1 round' : `${rounded} rounds`;
};
