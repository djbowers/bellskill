import { ProgramSession, WeightTabValue } from '~/types';
import { getWeightTabValue } from '~/utils';

import { StartingWeight, weightKey } from './deriveWeightGroups';

/**
 * One editable starting weight on the enrollment screen: a distinct movement
 * across the program's sessions, its config mode (bodyweight / single / double),
 * and the authored weight the picker pre-fills. `enroll_in_program` applies the
 * chosen weight to every occurrence of this movement, shifted by that session's
 * offset from `modalWeight`, so a program's heavier/lighter days scale along.
 */
export interface MovementWeightControl {
  movementName: string;
  /** Derived from `modalWeight`'s null-pattern: 'none' | '2h' | '1h' | 'double'. */
  mode: WeightTabValue;
  /** The movement's modal authored weight — the picker's pre-fill. */
  modalWeight: StartingWeight;
}

/** A movement's authored weight, mapped onto the shared-weight field names so it
 *  feeds `WeightSlots` (which reads `sharedWeight*`) directly. */
const movementWeight = (movement: {
  weightOneValue: number | null;
  weightOneUnit: StartingWeight['sharedWeightOneUnit'];
  weightTwoValue: number | null;
  weightTwoUnit: StartingWeight['sharedWeightTwoUnit'];
}): StartingWeight => ({
  sharedWeightOneValue: movement.weightOneValue,
  sharedWeightOneUnit: movement.weightOneUnit,
  sharedWeightTwoValue: movement.weightTwoValue,
  sharedWeightTwoUnit: movement.weightTwoUnit,
});

/** True when any session is a complex set — those movements share one bell pair
 *  for the whole complex, so enrollment offers a single shared weight rather
 *  than a control per movement. */
export const isComplexProgram = (sessions: ProgramSession[]): boolean =>
  sessions.some((session) => session.workoutOptions.workoutMode === 'complex');

/**
 * One weight control per distinct movement (by name), in first-appearance order.
 * Each movement's modal authored weight is the most common pair it carries
 * across sessions, tie-broken toward the lighter first weight — the same rule as
 * `deriveWeightGroups` and the `enroll_in_program` RPC, so the picker's pre-fill
 * equals the weight that clones.
 *
 * Bodyweight movements (all-null weights, mode 'none') are included so the
 * screen can label them, but they carry no editable weight.
 */
export const deriveMovementWeights = (
  sessions: ProgramSession[],
): MovementWeightControl[] => {
  const order: string[] = [];
  const pairs = new Map<
    string,
    Map<string, { weight: StartingWeight; count: number }>
  >();

  for (const session of sessions) {
    for (const movement of session.workoutOptions.movements) {
      const name = movement.movementName;
      if (!name) continue;
      if (!pairs.has(name)) {
        pairs.set(name, new Map());
        order.push(name);
      }
      const weight = movementWeight(movement);
      const byPair = pairs.get(name)!;
      const key = weightKey(weight);
      const existing = byPair.get(key);
      if (existing) existing.count += 1;
      else byPair.set(key, { weight, count: 1 });
    }
  }

  return order.map((movementName) => {
    const byPair = [...pairs.get(movementName)!.values()];
    const modal = byPair.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const oneA = a.weight.sharedWeightOneValue ?? 0;
      const oneB = b.weight.sharedWeightOneValue ?? 0;
      if (oneA !== oneB) return oneA - oneB;
      return (
        (a.weight.sharedWeightTwoValue ?? 0) -
        (b.weight.sharedWeightTwoValue ?? 0)
      );
    })[0].weight;

    return {
      movementName,
      mode: getWeightTabValue({
        weightOneValue: modal.sharedWeightOneValue,
        weightTwoValue: modal.sharedWeightTwoValue,
      }),
      modalWeight: modal,
    };
  });
};
