// recommend-session (PROD-87): validation of the LLM output.
//
// Structured outputs guarantee the JSON *shape*; this enforces the *semantics*
// the schema can't express. A failure here drives the single retry in llm.ts.
//
// Two kinds of check live here, and only one of them belongs to this file:
//
//   - Runnability ("could a lifter actually do this session?") comes from the
//     shared verifier, so the builder enforces the same rules (PROD-240). Its
//     errors become retry reasons; its warnings are logged, never retried on.
//   - The LLM contract ("did the model follow instructions?") stays local:
//     candidate-id membership and balance-mode pattern coverage.

import type { Pattern } from '../../../src/utils/patternDebt.ts';
import { recommendationToDraft } from '../../../src/utils/recommendationDraft.ts';
import { validateWorkout } from '../../../src/utils/validateWorkout.ts';
import type { Recommendation } from './types.ts';

/** Balance-mode coverage requirement: targets plus each candidate's credits. */
export interface CoverageRequirement {
  targets: Pattern[];
  creditsById: Map<string, readonly string[] | null>;
}

export class ValidationError extends Error {
  reasons: string[];
  constructor(reasons: string[]) {
    super(`Recommendation failed validation: ${reasons.join('; ')}`);
    this.name = 'ValidationError';
    this.reasons = reasons;
  }
}

/** `block 3 (Swing)`, or `the session` for a whole-session issue. */
const describeBlock = (rec: Recommendation, index?: number) =>
  index === undefined
    ? 'the session'
    : `block ${index + 1} (${rec.blocks[index]?.movement_name ?? 'unnamed'})`;

export function validateRecommendation(
  rec: Recommendation,
  candidateIds: Set<string>,
  coverage?: CoverageRequirement,
): void {
  const reasons: string[] = [];

  // Runnability: reps, weights, rung equality, empty blocks, zero duration.
  const { errors, warnings } = validateWorkout(recommendationToDraft(rec));
  for (const issue of errors) {
    reasons.push(`${describeBlock(rec, issue.movementIndex)} — ${issue.message}`);
  }
  if (warnings.length > 0) {
    console.warn(
      'recommend-session: runnability warnings',
      warnings.map((w) => `${describeBlock(rec, w.movementIndex)} — ${w.message}`),
    );
  }

  // LLM contract: every block must name a movement from the candidate list.
  for (const [i, block] of rec.blocks.entries()) {
    if (!candidateIds.has(block.user_movement_id)) {
      reasons.push(
        `${describeBlock(rec, i)} uses user_movement_id "${block.user_movement_id}", which is not in the candidate list`,
      );
    }
  }

  // Balance mode: the chosen movements' combined credits must cover every
  // target pattern (the deterministic coverage invariant).
  if (coverage && coverage.targets.length > 0) {
    const covered = new Set<string>();
    for (const block of rec.blocks) {
      for (const credit of coverage.creditsById.get(block.user_movement_id) ??
        []) {
        covered.add(credit);
      }
    }
    for (const target of coverage.targets) {
      if (!covered.has(target)) {
        reasons.push(
          `the session does not train the "${target}" pattern — include at least one candidate whose pays list covers ${target}`,
        );
      }
    }
  }

  if (reasons.length > 0) throw new ValidationError(reasons);
}
