import { ProgramSession, WeightUnit } from '~/types';
import { getWeightUnitLabel } from '~/utils';

export interface StartingWeight {
  sharedWeightOneValue: number | null;
  sharedWeightOneUnit: WeightUnit | null;
  sharedWeightTwoValue: number | null;
  sharedWeightTwoUnit: WeightUnit | null;
}

/**
 * One distinct authored weight across a program's sessions. `enroll_in_program`
 * clones the modal group at the enrollee's chosen weight and every other group
 * at that weight shifted by its authored offset, so a group is exactly the unit
 * the enrollment picker offers a control for.
 */
export interface WeightGroup {
  /** Stable identity: the authored weight pair. */
  key: string;
  /** The weight the seed authored for these sessions. */
  sourceWeight: StartingWeight;
  /** Authored `program_sessions.weight_label` ("Deload weeks"), when set. */
  label: string | null;
  /** Always-available fallback: "8 kg lighter · weeks 4, 8". */
  description: string;
  sessionCount: number;
  weekNumbers: number[];
  /** The program's working weight — the group the other offsets hang off. */
  isModal: boolean;
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
export const resolveSessionPlaceholder = (
  session: ProgramSession,
): StartingWeight => {
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

export const weightKey = (weight: StartingWeight): string =>
  [
    weight.sharedWeightOneValue,
    weight.sharedWeightOneUnit,
    weight.sharedWeightTwoValue,
    weight.sharedWeightTwoUnit,
  ].join('|');

/**
 * How this group differs from the working weight, for programs whose sessions
 * carry no authored `weight_label` (anything user-built). Names the slot that
 * actually differs — a program can vary only its second bell — and locates the
 * group by week while the week list is still short enough to scan.
 */
const describeGroup = (
  source: StartingWeight,
  modal: StartingWeight,
  sessionCount: number,
  weekNumbers: number[],
): string => {
  const oneDelta =
    (source.sharedWeightOneValue ?? 0) - (modal.sharedWeightOneValue ?? 0);
  const twoDelta =
    (source.sharedWeightTwoValue ?? 0) - (modal.sharedWeightTwoValue ?? 0);
  const delta = oneDelta !== 0 ? oneDelta : twoDelta;
  const unit = getWeightUnitLabel(
    (oneDelta !== 0 ? source.sharedWeightOneUnit : source.sharedWeightTwoUnit) ??
      source.sharedWeightOneUnit,
  );

  const relation =
    delta === 0
      ? 'Alternate loading'
      : `${Math.abs(delta)}${unit ? ` ${unit}` : ''} ${delta < 0 ? 'lighter' : 'heavier'}`;

  const where =
    weekNumbers.length <= 4
      ? `week${weekNumbers.length > 1 ? 's' : ''} ${weekNumbers.join(', ')}`
      : `${sessionCount} session${sessionCount > 1 ? 's' : ''}`;

  return `${relation} · ${where}`;
};

/**
 * Groups a program's sessions by their authored placeholder weight, flagging
 * the modal (most common) group as the working weight. Ties break toward the
 * lighter first weight, mirroring the enroll_in_program RPC's
 * `ORDER BY cnt DESC, weight_val`; groups are returned in first-appearance
 * order so the picker lists them the way the program reads.
 *
 * Sessions with no loaded bell weight (bodyweight placeholders) don't form a
 * group; a program that is entirely bodyweight yields none, and callers fall
 * back to the generic double-24kg default.
 */
export const deriveWeightGroups = (
  sessions: ProgramSession[],
): WeightGroup[] => {
  const groups = new Map<
    string,
    {
      sourceWeight: StartingWeight;
      label: string | null;
      sessionCount: number;
      weekNumbers: Set<number>;
    }
  >();

  for (const session of sessions) {
    const sourceWeight = resolveSessionPlaceholder(session);
    if (sourceWeight.sharedWeightOneValue == null) continue;

    const key = weightKey(sourceWeight);
    const existing = groups.get(key);
    if (existing) {
      existing.sessionCount += 1;
      existing.weekNumbers.add(session.weekNumber);
      existing.label ??= session.weightLabel;
    } else {
      groups.set(key, {
        sourceWeight,
        label: session.weightLabel,
        sessionCount: 1,
        weekNumbers: new Set([session.weekNumber]),
      });
    }
  }

  if (groups.size === 0) return [];

  const entries = [...groups.entries()];
  const modalKey = [...entries]
    .sort((a, b) => {
      if (b[1].sessionCount !== a[1].sessionCount)
        return b[1].sessionCount - a[1].sessionCount;
      return (
        (a[1].sourceWeight.sharedWeightOneValue ?? 0) -
        (b[1].sourceWeight.sharedWeightOneValue ?? 0)
      );
    })[0][0];
  const modal = groups.get(modalKey)!.sourceWeight;

  return entries.map(([key, group]) => {
    const weekNumbers = [...group.weekNumbers].sort((a, b) => a - b);
    return {
      key,
      sourceWeight: group.sourceWeight,
      label: group.label,
      description: describeGroup(
        group.sourceWeight,
        modal,
        group.sessionCount,
        weekNumbers,
      ),
      sessionCount: group.sessionCount,
      weekNumbers,
      isModal: key === modalKey,
    };
  });
};

/**
 * Where a non-modal group lands once the enrollee picks a working weight —
 * the picker's pre-fill, and a mirror of `enroll_in_program`'s offset math so
 * the value shown is the value that clones. A slot is shifted only when the
 * group's authored unit matches the chosen one; on a mismatch it falls back to
 * the working weight rather than converting kg into a pounds number no bell
 * comes in. A zero delta passes the working value through untouched, which is
 * what keeps a single-bell program's weight two at 0 instead of clamping to 1.
 */
export const applyGroupOffset = (
  source: StartingWeight,
  modal: StartingWeight,
  working: StartingWeight,
): StartingWeight => {
  const shift = (
    sourceValue: number | null,
    sourceUnit: WeightUnit | null,
    modalValue: number | null,
    workingValue: number | null,
    workingUnit: WeightUnit | null,
  ): number | null => {
    if (workingValue == null) return null;
    const delta =
      sourceUnit === workingUnit ? (sourceValue ?? 0) - (modalValue ?? 0) : 0;
    return delta === 0 ? workingValue : Math.max(workingValue + delta, 1);
  };

  return {
    sharedWeightOneValue: shift(
      source.sharedWeightOneValue,
      source.sharedWeightOneUnit,
      modal.sharedWeightOneValue,
      working.sharedWeightOneValue,
      working.sharedWeightOneUnit,
    ),
    sharedWeightOneUnit: working.sharedWeightOneUnit,
    sharedWeightTwoValue: shift(
      source.sharedWeightTwoValue,
      source.sharedWeightTwoUnit,
      modal.sharedWeightTwoValue,
      working.sharedWeightTwoValue,
      working.sharedWeightTwoUnit,
    ),
    sharedWeightTwoUnit: working.sharedWeightTwoUnit,
  };
};

/**
 * The working weight the enrollment picker pre-fills: the modal group's
 * authored placeholder. This is what single-bell programs (Snatch Test),
 * swing-only ones (10K Swing) and double-bell ones (DFW, Armor, Easy Strength)
 * each need, rather than one fixed 24kg.
 */
export const deriveStartingWeight = (
  sessions: ProgramSession[],
): StartingWeight =>
  deriveWeightGroups(sessions).find((group) => group.isModal)?.sourceWeight ??
  DEFAULT_STARTING_WEIGHT;
