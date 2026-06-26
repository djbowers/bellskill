// recommend-session (PROD-87): prompt construction.
//
// Kept separate from transport (llm.ts) so prompt quality can be iterated in
// PROD-88 without touching the API plumbing.

import type { RecommenderInputs } from './types.ts';

export function buildSystemPrompt(): string {
  return [
    'You are an expert kettlebell programming coach. You know the Big 6 (swing,',
    'clean, press, snatch, squat, get-up) and common protocols (Simple & Sinister,',
    'Rite of Passage). You design a single, focused next training session.',
    '',
    'Rules:',
    "- Choose movements ONLY from the candidate list. Use each block's exact",
    '  user_movement_id from that list — never invent an id or a movement.',
    '- Size the session to the time the lifter has and how they say they feel',
    '  today. When they are tired, sore, or short on time, scale volume down.',
    '- Prescribe weights in kilograms (whole or half kg) and rep schemes as a list',
    '  of positive integers (one entry per rung/set).',
    '- Give a short, concrete rationale a thoughtful coach would give — tie it to',
    '  their goal, recent history, and readiness. Avoid generic filler.',
  ].join('\n');
}

export function buildUserPrompt(inputs: RecommenderInputs): string {
  const candidateLines = inputs.candidates
    .map(
      (c) =>
        `- ${c.name}${c.is_big_6 ? ' (Big 6)' : ''} [user_movement_id: ${c.user_movement_id}]`,
    )
    .join('\n');

  const historyLines = inputs.recent_history.length
    ? inputs.recent_history
        .map((w) => {
          const moves = w.movements
            .map(
              (m) =>
                `${m.name} ${m.rep_scheme.join('/')}${m.weight_kg ? ` @ ${m.weight_kg}kg` : ''}`,
            )
            .join('; ');
          return `- ${w.completed_at.slice(0, 10)} · goal ${w.goal}${w.rpe ? ` · RPE ${w.rpe}` : ''} · ${moves}`;
        })
        .join('\n')
    : '- (no recent workouts logged)';

  return [
    `Training goal: ${inputs.training_goal ?? '(none provided)'}`,
    `How they feel today: ${inputs.readiness ?? '(not provided)'}`,
    `Days since last workout: ${inputs.days_since_last_workout ?? '(unknown)'}`,
    '',
    'Recent workouts (most recent first):',
    historyLines,
    '',
    'Candidate movements (choose only from these):',
    candidateLines,
    '',
    'Recommend their next session now.',
  ].join('\n');
}

/** Appended on a retry when the first attempt failed validation. */
export function buildCorrectionPrompt(reasons: string[]): string {
  return [
    'Your previous response was rejected for these reasons:',
    ...reasons.map((r) => `- ${r}`),
    '',
    'Produce a corrected recommendation that uses only candidate user_movement_ids',
    'and positive integer reps and weights.',
  ].join('\n');
}
