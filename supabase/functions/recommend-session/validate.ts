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
//     candidate-id membership and target-pattern coverage.

import {
  type EquipmentSummary,
  validateSessionWeights,
} from '../../../src/utils/equipment.ts';
import type { Pattern } from '../../../src/utils/patternDebt.ts';
import { recommendationToDraft } from '../../../src/utils/recommendationDraft.ts';
import { validateWorkout } from '../../../src/utils/validateWorkout.ts';
import type { Recommendation } from './types.ts';

/** Target-pattern coverage requirement: targets plus each candidate's credits. */
export interface CoverageRequirement {
  targets: Pattern[];
  creditsById: Map<string, readonly string[] | null>;
}

/** Catalog answer to "is this a two-bell movement?", null when unlinked. */
export type DoublesById = Map<string, boolean | null>;

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
  equipment?: EquipmentSummary | null,
  doublesById?: DoublesById,
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

    // Bell count is an LLM-contract check, not runnability: the shared verifier
    // has no concept of how many bells a block uses.
    const bells = block.bells ?? 1;
    if (!Number.isInteger(bells) || bells < 1 || bells > 2) {
      reasons.push(`${describeBlock(rec, i)} claims ${bells} bells — use 1 or 2`);
    } else if (
      bells === 2 &&
      doublesById?.get(block.user_movement_id) === false
    ) {
      // Only when the catalog positively says it is a one-bell movement; an
      // unlinked movement (null) stays the lifter's call.
      reasons.push(
        `${describeBlock(rec, i)} is not a double-bell movement — prescribe it with 1 bell`,
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

  // Equipment: only checked when the lifter has recorded some. Weights must be
  // loadable *without re-plating mid-session* — see validateSessionWeights.
  if (equipment) {
    reasons.push(
      ...validateSessionWeights(
        equipment,
        rec.blocks.map((b) => ({ weight_kg: b.weight_kg, bells: b.bells ?? 1 })),
        rec.adjustable_settings_kg ?? [],
      ),
    );
  }

  if (reasons.length > 0) throw new ValidationError(reasons);
}
