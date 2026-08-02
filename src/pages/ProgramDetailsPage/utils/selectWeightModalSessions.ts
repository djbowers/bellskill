import type { SessionState } from '~/api';
import { ProgramSession } from '~/types';

/** A program session paired with its enrollment progress state. */
export interface SessionWithState {
  session: ProgramSession;
  /** `upcoming` = incomplete; `done` / `skipped` = has a completion row. */
  state: SessionState;
}

/**
 * Sessions that form the working-weight modal for `adjust_program_weights` and
 * the Adjust Weights dialog prefill. Mirrors the RPC's label-aware baseline:
 *
 *   1. Incomplete + unlabeled (`weightLabel` null), if any
 *   2. Else any unlabeled (completed work — A+A deload-week case)
 *   3. Else incomplete (all-labeled programs like Snatch Test)
 *
 * Offset groups (`'Deload weeks'`, `'Test day'`, …) are excluded from tiers 1–2
 * so their authored deltas stay relative to the true working load.
 */
export const selectWeightModalSessions = (
  items: SessionWithState[],
): ProgramSession[] => {
  const incomplete = items.filter((item) => item.state === 'upcoming');
  const unlabeledIncomplete = incomplete.filter(
    (item) => item.session.weightLabel == null,
  );
  if (unlabeledIncomplete.length > 0) {
    return unlabeledIncomplete.map((item) => item.session);
  }

  const unlabeled = items.filter((item) => item.session.weightLabel == null);
  if (unlabeled.length > 0) {
    return unlabeled.map((item) => item.session);
  }

  return incomplete.map((item) => item.session);
};
