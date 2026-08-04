// recommend-session (PROD-87): validation of the LLM output.
//
// Structured outputs guarantee the JSON *shape*; this enforces the *semantics*
// the schema can't express — movement ids must be real candidates, and reps and
// weights must be sane. A failure here drives the single retry in llm.ts.

import type { Pattern } from '../../../src/utils/patternDebt.ts';
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

const MAX_WEIGHT_KG = 100; // generous ceiling; guards against absurd hallucinations
const MAX_REP = 100;

export function validateRecommendation(
  rec: Recommendation,
  candidateIds: Set<string>,
  coverage?: CoverageRequirement,
): void {
  const reasons: string[] = [];

  if (rec.blocks.length === 0) {
    reasons.push('the session has no movement blocks');
  }

  for (const [i, block] of rec.blocks.entries()) {
    const where = `block ${i + 1} (${block.movement_name})`;

    if (!candidateIds.has(block.user_movement_id)) {
      reasons.push(
        `${where} uses user_movement_id "${block.user_movement_id}", which is not in the candidate list`,
      );
    }

    if (!Number.isFinite(block.weight_kg) || block.weight_kg <= 0) {
      reasons.push(`${where} has a non-positive weight`);
    } else if (block.weight_kg > MAX_WEIGHT_KG) {
      reasons.push(`${where} has an implausible weight (${block.weight_kg} kg)`);
    }

    if (block.rep_scheme.length === 0) {
      reasons.push(`${where} has an empty rep scheme`);
    } else if (
      block.rep_scheme.some(
        (r) => !Number.isInteger(r) || r <= 0 || r > MAX_REP,
      )
    ) {
      reasons.push(`${where} has invalid rep counts`);
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
