// recommend-program: validation of the LLM output.
//
// Structured outputs guarantee the JSON *shape*; this enforces the *semantics*
// the schema can't express — the pick must be a real candidate and the mode
// must be feasible given the user's slots and stack. A failure here drives the
// single corrective retry in llm.ts.

import type { ProgramRecommendation, RecommenderInputs } from './types.ts';

export class ValidationError extends Error {
  reasons: string[];
  constructor(reasons: string[]) {
    super(`Recommendation failed validation: ${reasons.join('; ')}`);
    this.name = 'ValidationError';
    this.reasons = reasons;
  }
}

export function validateRecommendation(
  rec: ProgramRecommendation,
  inputs: RecommenderInputs,
): void {
  const reasons: string[] = [];

  // Candidates already exclude active/queued programs, so this single check
  // also rejects re-picks of anything the user is already running.
  const candidate = inputs.candidates.find(
    (c) => c.program_id === rec.program_id,
  );
  if (!candidate) {
    reasons.push(
      `program_id "${rec.program_id}" is not in the candidate list`,
    );
  }

  if (rec.mode === 'concurrent') {
    if (inputs.slots_available <= 0) {
      reasons.push(
        'mode "concurrent" requires an open program slot; all slots are taken — use mode "queue"',
      );
    }
    if (candidate?.stack_fit?.verdict === 'conflict') {
      reasons.push(
        `mode "concurrent" is not allowed for ${candidate.title}: its stack-fit verdict is "conflict" — pick another candidate or use mode "queue"`,
      );
    }
  }

  if (
    rec.mode === 'queue' &&
    inputs.active_programs.length === 0 &&
    inputs.queued_programs.length === 0
  ) {
    reasons.push(
      'mode "queue" makes no sense with nothing active or queued — use mode "concurrent"',
    );
  }

  if (rec.rationale.trim().length === 0) {
    reasons.push('the rationale is empty');
  }

  if (reasons.length > 0) throw new ValidationError(reasons);
}
