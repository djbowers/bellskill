import { ProgramSession, WeightUnit } from '~/types';

export interface StartingWeight {
  sharedWeightOneValue: number | null;
  sharedWeightOneUnit: WeightUnit | null;
  sharedWeightTwoValue: number | null;
  sharedWeightTwoUnit: WeightUnit | null;
}

// Fallback for the degenerate case (no sessions, or a program with no loaded
// bell weight at all): double loading at 24kg, the app's generic starting
// point. No seeded shared program hits this today.
const DEFAULT_STARTING_WEIGHT: StartingWeight = {
  sharedWeightOneValue: 24,
  sharedWeightOneUnit: 'kilograms',
  sharedWeightTwoValue: 24,
  sharedWeightTwoUnit: 'kilograms',
};

/**
 * The weight a session's working sets actually start with, mirroring
 * resolveSharedWeights' priority: the session's own shared weight if set,
 * otherwise its first movement's weight (the placeholder load).
 */
const resolveSessionPlaceholder = (session: ProgramSession): StartingWeight => {
  const options = session.workoutOptions;
  const hasSharedWeight =
    options.sharedWeightOneValue != null || options.sharedWeightOneUnit != null;

  if (hasSharedWeight) {
    return {
      sharedWeightOneValue: options.sharedWeightOneValue,
      sharedWeightOneUnit: options.sharedWeightOneUnit,
      sharedWeightTwoValue: options.sharedWeightTwoValue,
      sharedWeightTwoUnit: options.sharedWeightTwoUnit,
    };
  }

  const first = options.movements[0];
  return {
    sharedWeightOneValue: first?.weightOneValue ?? null,
    sharedWeightOneUnit: first?.weightOneUnit ?? null,
    sharedWeightTwoValue: first?.weightTwoValue ?? null,
    sharedWeightTwoUnit: first?.weightTwoUnit ?? null,
  };
};

const weightKey = (weight: StartingWeight): string =>
  [
    weight.sharedWeightOneValue,
    weight.sharedWeightOneUnit,
    weight.sharedWeightTwoValue,
    weight.sharedWeightTwoUnit,
  ].join('|');

/**
 * Derives the starting-weight prompt's pre-fill from a shared program's own
 * seeded sessions: the modal (most common) placeholder weight + loading mode
 * across its sessions. This lets the prompt match each program's equipment
 * profile — e.g. two-hand for the 10,000 Swing Challenge, single for the
 * Snatch Test plan, double for Dry Fighting Weight — rather than assuming one
 * fixed load. Ties break toward the lighter first weight, mirroring the
 * enroll_in_program RPC's `ORDER BY cnt DESC, weight_val`.
 *
 * Sessions with no loaded bell weight (bodyweight placeholders) don't count
 * toward the mode; a program that is entirely bodyweight falls back to the
 * generic double-24kg default.
 */
export const deriveStartingWeight = (
  sessions: ProgramSession[],
): StartingWeight => {
  const placeholders = sessions
    .map(resolveSessionPlaceholder)
    .filter((weight) => weight.sharedWeightOneValue != null);

  if (placeholders.length === 0) return DEFAULT_STARTING_WEIGHT;

  const counts = new Map<string, { weight: StartingWeight; count: number }>();
  for (const weight of placeholders) {
    const key = weightKey(weight);
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { weight, count: 1 });
  }

  const modal = [...counts.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return (
      (a.weight.sharedWeightOneValue ?? 0) -
      (b.weight.sharedWeightOneValue ?? 0)
    );
  })[0];

  return modal.weight;
};
