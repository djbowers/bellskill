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

export const isMaxRung = (rung: number): boolean => rung === MAX_RUNG;

export const hasMaxRung = (repScheme: readonly number[]): boolean =>
  repScheme.some(isMaxRung);

/** How a rung reads to the user: "Max", "1:30", or "5". */
export const formatRungValue = (rung: number, timedRungs = false): string =>
  isMaxRung(rung) ? 'Max' : timedRungs ? formatRungDuration(rung) : `${rung}`;
