// Stack fit: does adding one more concurrent program to what's already running
// make sense? Reads the editorial metadata stamped on programs
// (`focus_tags`, `systemic_demand`) and answers on two independent axes.
//
// 1. Recovery cost. Demand is the binding constraint — two `high` programs
//    collide even when they train nothing in common. Each program spends from a
//    shared weekly budget.
// 2. Redundancy. Two programs sharing most of their focus tags are buying the
//    same adaptation twice, which is wasteful rather than dangerous.
//
// Advisory only: this never blocks an enrollment. A lifter who knows their own
// recovery gets to overrule it.
//
// Pure + deterministic, like patternDebt, so the scoring can be unit-tested here
// and reused as-is if a recommender edge function ever wants it.
import { Program, ProgramFocusTag, ProgramSystemicDemand } from '~/types';

export type StackVerdict = 'good' | 'caution' | 'conflict';

export interface StackFit {
  verdict: StackVerdict;
  /** Total demand spent by the candidate plus everything already active. */
  load: number;
  /** One plain-language sentence per issue found. Empty on a clean 'good'. */
  reasons: string[];
}

// Tunable model constants.

/** Weekly recovery cost of one program, by its editorial demand rating. */
const DEMAND_COST: Record<ProgramSystemicDemand, number> = {
  low: 1,
  moderate: 2,
  high: 3,
};

/**
 * Demand a lifter can carry across every concurrent program before the stack is
 * more than the sum of its parts. Calibrated against pairings that are known to
 * work and known not to: Dry Fighting Weight (3) + Easy Strength (1) is the
 * classic hard/easy pairing and lands at 4; two `high` programs land at 6.
 */
const STACK_BUDGET = 5;

/** At or above the budget, but not over it — workable, worth a warning. */
const CAUTION_LOAD = 4;

/** Shared focus tags before two programs count as buying the same adaptation. */
const REDUNDANT_TAG_OVERLAP = 2;

const demandCost = (program: Program): number =>
  program.systemicDemand ? DEMAND_COST[program.systemicDemand] : 0;

const sharedTags = (a: Program, b: Program): ProgramFocusTag[] =>
  a.focusTags.filter((tag) => b.focusTags.includes(tag));

/** Joins names as "A", "A and B", "A, B, and C". */
const listNames = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
};

/**
 * Assess adding `candidate` on top of the programs already running.
 *
 * Returns `null` when there is nothing to say: no active programs (the first
 * program is never a stacking question), or the candidate carries no editorial
 * metadata (every user-authored program), which would make any verdict a guess.
 */
export const assessStackFit = (
  candidate: Program,
  active: Program[],
): StackFit | null => {
  if (active.length === 0) return null;
  if (!candidate.systemicDemand && candidate.focusTags.length === 0)
    return null;

  const load =
    demandCost(candidate) + active.reduce((sum, p) => sum + demandCost(p), 0);
  const reasons: string[] = [];

  // Recovery cost. Only meaningful once every program in the stack is rated —
  // an unrated program contributes 0, which would understate a real total.
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

  // Redundancy, per already-active program.
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
};

/** Headline for a fit, suitable as a card title. */
export const stackFitHeadline = (fit: StackFit): string => {
  if (fit.verdict === 'conflict') return 'Heavy stack';
  if (fit.verdict === 'caution') return 'Workable stack';
  return 'Good pairing';
};
