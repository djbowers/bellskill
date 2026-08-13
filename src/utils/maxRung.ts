// A rung of 0 means "to failure" — max reps, or max time on a timed movement.
//
// It rides inside `repScheme` rather than a per-movement flag so a ladder can mix
// prescribed rungs with a max one: [1, 2, 3, 4, 5, 0] or [15, 30, 45, 0]. The
// value is the natural sentinel — zero reps is not a set anyone programs, and the
// column is already a smallint[].
//
// Dependency-free (relative imports only) so the Deno edge runtime can import it
// the way it already imports validateWorkout.ts.

import { formatRungDuration } from './formatRungDuration.ts';

export const MAX_RUNG = 0;

/**
 * How a max rung reads. A symbol rather than the word: it fits the same chip as
 * a two-digit rep count (a "Max" chip clipped in the ladder's scroller) and
 * carries across reps and seconds without changing wording.
 */
export const MAX_RUNG_SYMBOL = '∞';

export const isMaxRung = (rung: number): boolean => rung === MAX_RUNG;

export const hasMaxRung = (repScheme: readonly number[]): boolean =>
  repScheme.some(isMaxRung);

/** How a rung reads to the user: "∞", "1:30", or "5". */
export const formatRungValue = (rung: number, timedRungs = false): string =>
  isMaxRung(rung)
    ? MAX_RUNG_SYMBOL
    : timedRungs
      ? formatRungDuration(rung)
      : `${rung}`;

/** Spoken form of a rung, for the labels the symbol alone would fail. */
export const describeRungValue = (rung: number, timedRungs = false): string =>
  isMaxRung(rung)
    ? `max ${timedRungs ? 'time' : 'reps'}`
    : timedRungs
      ? formatRungDuration(rung)
      : `${rung} reps`;
