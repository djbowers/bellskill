// The single answer to "is this workout runnable?" (PROD-240).
//
// The builder and the AI recommender used to check disjoint rule sets, so each
// shipped bugs the other would have caught — a recommendation with 4/3/3 rungs
// passed the recommender, loaded into circuit mode, and left a dead Start button.
// Every producer now runs these rules: the builder, repeat-workout, program
// sessions, curated workouts, and the recommender.
//
// Kept pure and dependency-free (relative `.ts` imports, nothing from
// ~/components, ~/pages, ~/api or ~/contexts) so the Deno edge runtime can import
// it the way it already imports patternDebt.ts.

import type { WorkoutMode } from '../types/workout-mode.type.ts';

export type IssueSeverity = 'error' | 'warning';

export type IssueCode =
  | 'no_movements'
  | 'empty_movement_name'
  | 'non_positive_goal'
  | 'unequal_rungs'
  | 'empty_rep_scheme'
  | 'invalid_reps'
  | 'non_positive_weight'
  | 'interval_with_timed_rungs'
  | 'interval_with_max_reps'
  | 'implausible_weight';

/** A repair the UI may offer. Data only — the caller owns applying it. */
export type IssueSuggestion =
  | { kind: 'switchMode'; mode: WorkoutMode }
  | { kind: 'padRungs'; targetRungs: number };

export interface WorkoutIssue {
  code: IssueCode;
  severity: IssueSeverity;
  /** User-facing sentence; also fed to the LLM on retry. */
  message: string;
  /** Index into `movements`, when the issue is movement-scoped. */
  movementIndex?: number;
  /** Offered repairs, in the order the UI should present them. */
  suggestions?: IssueSuggestion[];
}

/**
 * The minimum both callers can produce. `WorkoutOptions` satisfies it
 * structurally; the recommender adapts its `Recommendation` in
 * {@link recommendationToDraft}.
 */
export interface WorkoutDraft {
  workoutMode: WorkoutMode;
  workoutGoal: number;
  intervalTimer: number;
  movements: ReadonlyArray<{
    movementName: string;
    repScheme: number[];
    timedRungs?: boolean;
    maxReps?: boolean;
    /** null means bodyweight, which is valid. */
    weightOneValue: number | null;
    /**
     * Not validated: 0 is how the builder marks a one-handed movement, so a
     * non-positive second weight is meaningful rather than broken.
     */
    weightTwoValue?: number | null;
  }>;
}

export interface WorkoutValidation {
  /** Block Start / trigger the LLM's corrective retry. */
  errors: WorkoutIssue[];
  /** Surface as hints. Never block. */
  warnings: WorkoutIssue[];
}

const MAX_REP = 100;
/** Generous kettlebell ceiling — absurd, but not impossible, so only a warning. */
const MAX_PLAUSIBLE_WEIGHT_KG = 100;

/**
 * Only straight sets exempts a workout from the equal-rungs rule: it gives each
 * movement its own ladder. Circuit and complex both walk every movement with one
 * shared rung pointer, so a short ladder runs out mid-round.
 */
const requiresEqualRungs = (mode: WorkoutMode) => mode !== 'straightSets';

const RUNG_POINTER_MODE_LABELS: Record<WorkoutMode, string> = {
  circuit: 'Circuit',
  straightSets: 'Straight Sets',
  complex: 'Complex',
};

export const validateWorkout = (draft: WorkoutDraft): WorkoutValidation => {
  const errors: WorkoutIssue[] = [];
  const warnings: WorkoutIssue[] = [];
  const { movements, workoutMode } = draft;

  if (movements.length === 0) {
    errors.push({
      code: 'no_movements',
      severity: 'error',
      message: 'Add at least one movement.',
    });
  }

  if (!Number.isFinite(draft.workoutGoal) || draft.workoutGoal <= 0) {
    errors.push({
      code: 'non_positive_goal',
      severity: 'error',
      message: 'Set a workout goal greater than zero.',
    });
  }

  const rungCounts = movements.map((movement) => movement.repScheme.length);
  if (
    requiresEqualRungs(workoutMode) &&
    movements.length > 1 &&
    rungCounts.some((count) => count !== rungCounts[0])
  ) {
    const targetRungs = Math.max(...rungCounts);
    errors.push({
      code: 'unequal_rungs',
      severity: 'error',
      message: `Rep schemes differ across movements. ${RUNG_POINTER_MODE_LABELS[workoutMode]} mode runs one rung at a time, so every movement needs the same number.`,
      suggestions: [
        { kind: 'switchMode', mode: 'straightSets' },
        { kind: 'padRungs', targetRungs },
      ],
    });
  }

  movements.forEach((movement, movementIndex) => {
    if (movement.movementName.trim() === '') {
      errors.push({
        code: 'empty_movement_name',
        severity: 'error',
        message: 'This movement needs a name.',
        movementIndex,
      });
    }

    if (movement.repScheme.length === 0) {
      errors.push({
        code: 'empty_rep_scheme',
        severity: 'error',
        message: 'This movement has an empty rep scheme — add at least one rung.',
        movementIndex,
      });
    } else if (
      movement.repScheme.some(
        (rung) => !Number.isInteger(rung) || rung <= 0 || rung > MAX_REP,
      )
    ) {
      errors.push({
        code: 'invalid_reps',
        severity: 'error',
        message: `This movement has invalid rep counts — every rung must be a whole number from 1 to ${MAX_REP}.`,
        movementIndex,
      });
    }

    // null is bodyweight, which is a real workout. The rule is "weight, when
    // present, must be positive".
    if (movement.weightOneValue !== null) {
      if (
        !Number.isFinite(movement.weightOneValue) ||
        movement.weightOneValue <= 0
      ) {
        errors.push({
          code: 'non_positive_weight',
          severity: 'error',
          message:
            'This movement has a non-positive weight. Use a weight above zero, or clear it for bodyweight.',
          movementIndex,
        });
      } else if (movement.weightOneValue > MAX_PLAUSIBLE_WEIGHT_KG) {
        warnings.push({
          code: 'implausible_weight',
          severity: 'warning',
          message: `${movement.weightOneValue} kg is an implausible weight for a kettlebell — worth a second look.`,
          movementIndex,
        });
      }
    }
  });

  if (draft.intervalTimer > 0) {
    movements.forEach((movement, movementIndex) => {
      if (movement.timedRungs) {
        warnings.push({
          code: 'interval_with_timed_rungs',
          severity: 'warning',
          message:
            'The interval timer and this movement’s timed rungs both drive the set clock. Turn one of them off.',
          movementIndex,
        });
      }

      // An error, not a warning like timed rungs: the interval advances the set
      // on its own, so there is no Continue press to report max reps against and
      // the count would be silently lost.
      if (movement.maxReps) {
        errors.push({
          code: 'interval_with_max_reps',
          severity: 'error',
          message:
            'Max reps needs a Continue press to report against, and the interval timer advances the set on its own. Turn one of them off.',
          movementIndex,
        });
      }
    });
  }

  return { errors, warnings };
};
