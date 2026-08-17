// recommend-program: deterministic scoring.
//
// Pattern debt comes straight from the shared scorer (src/utils/patternDebt.ts)
// — that module is free of app-path imports, so it's imported directly rather
// than copied. Stack fit has no such shared module yet, so it's copied here
// verbatim from `src/utils/stackFit.ts`, which imports `~/types` (unresolvable
// by the Deno edge runtime). Keep it in sync with that source and
// docs/pattern-debt-scoring-model.md.

export {
  PATTERNS,
  computePatternBalance,
  type MovementAggregate,
  type Pattern,
  type DebtBand,
  type OverallBalance,
  type PatternBalance,
  type PatternDebt,
  type PatternRpe,
} from '../../../src/utils/patternDebt.ts';

export {
  computeModalityBalance,
  type Modality,
  type ModalityBalance,
  type ModalityDebt,
  type OverallModalityBalance,
} from '../../../src/utils/modalityDebt.ts';

export {
  groupProgramModalityProfiles,
  type ProgramModalityRow,
} from '../../../src/utils/programModality.ts';

// ---------------------------------------------------------------------------
// Stack fit (src/utils/stackFit.ts)
// ---------------------------------------------------------------------------

export type ProgramSystemicDemand = 'low' | 'moderate' | 'high';

export type StackVerdict = 'good' | 'caution' | 'conflict';

/** The slice of a program the stack-fit model reads. */
export interface StackProgram {
  title: string;
  focusTags: string[];
  systemicDemand: ProgramSystemicDemand | null;
}

export interface StackFit {
  verdict: StackVerdict;
  load: number;
  reasons: string[];
}

const DEMAND_COST: Record<ProgramSystemicDemand, number> = {
  low: 1,
  moderate: 2,
  high: 3,
};

const STACK_BUDGET = 5;
const CAUTION_LOAD = 4;
const REDUNDANT_TAG_OVERLAP = 2;

const demandCost = (program: StackProgram): number =>
  program.systemicDemand ? DEMAND_COST[program.systemicDemand] : 0;

const sharedTags = (a: StackProgram, b: StackProgram): string[] =>
  a.focusTags.filter((tag) => b.focusTags.includes(tag));

const listNames = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
};

/**
 * Assess adding `candidate` on top of the programs already running. Returns
 * `null` when there is nothing to say (no active programs, or an unrated
 * candidate).
 */
export function assessStackFit(
  candidate: StackProgram,
  active: StackProgram[],
): StackFit | null {
  if (active.length === 0) return null;
  if (!candidate.systemicDemand && candidate.focusTags.length === 0)
    return null;

  const load =
    demandCost(candidate) + active.reduce((sum, p) => sum + demandCost(p), 0);
  const reasons: string[] = [];

  const fullyRated =
    !!candidate.systemicDemand && active.every((p) => !!p.systemicDemand);
  const overBudget = fullyRated && load > STACK_BUDGET;

  if (overBudget) {
    reasons.push(
      `This is more hard training than most people recover from at once. ${candidate.title} is ${candidate.systemicDemand} demand on top of ${listNames(active.map((p) => p.title))}.`,
    );
  } else if (fullyRated && load >= CAUTION_LOAD) {
    reasons.push(
      `This fills your recovery budget. It works if the rest of your week is easy, but there's no room left for a third.`,
    );
  }

  const redundant = active.filter(
    (p) => sharedTags(candidate, p).length >= REDUNDANT_TAG_OVERLAP,
  );
  if (redundant.length > 0) {
    const overlap = sharedTags(candidate, redundant[0]);
    reasons.push(
      `${listNames(redundant.map((p) => p.title))} already covers ${listNames(overlap)}. You'd be training the same qualities twice.`,
    );
  }

  if (overBudget) return { verdict: 'conflict', load, reasons };
  if (reasons.length > 0) return { verdict: 'caution', load, reasons };
  return { verdict: 'good', load, reasons };
}
