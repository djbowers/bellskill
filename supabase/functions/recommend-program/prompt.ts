// recommend-program: prompt construction.
//
// Kept separate from transport (llm.ts) so prompt quality can be iterated
// without touching the API plumbing.

import type { RecommenderInputs } from './types.ts';

export function buildSystemPrompt(): string {
  return [
    'You are an expert kettlebell programming coach. You are choosing exactly',
    'ONE training program from a candidate catalog for a lifter, and deciding',
    'whether they should start it now alongside their current programs',
    '(mode "concurrent") or queue it to begin when a current program finishes',
    '(mode "queue").',
    '',
    'Rules:',
    '- Choose ONLY from the candidate list, using its exact program_id. Never',
    '  invent an id, and never pick a program that is already active or queued.',
    '- Prefer candidates whose focus tags pay down the undertrained movement',
    '  patterns named in the pattern-debt balance.',
    '- Respect the precomputed stack-fit verdicts: mode "concurrent" is allowed',
    '  only when slots_available > 0 AND that candidate\'s stack-fit verdict is',
    '  not "conflict". Otherwise use mode "queue".',
    '- If the lifter has no active programs, use mode "concurrent".',
    '- Give a short, concrete rationale (2-4 sentences) a thoughtful coach would',
    '  give — tie it to their goal, pattern balance, and current programs, and',
    '  explain why now vs queued. Avoid generic filler.',
  ].join('\n');
}

export function buildUserPrompt(inputs: RecommenderInputs): string {
  const activeLines = inputs.active_programs.length
    ? inputs.active_programs
        .map(
          (p) =>
            `- ${p.title} · ${p.progress} sessions done · demand ${p.systemic_demand ?? 'unrated'} · focus ${p.focus_tags.join(', ') || '(none)'}${p.last_worked_at ? ` · last worked ${p.last_worked_at.slice(0, 10)}` : ''}`,
        )
        .join('\n')
    : '- (no active programs)';

  const queuedLines = inputs.queued_programs.length
    ? inputs.queued_programs.map((p) => `- ${p.title}`).join('\n')
    : '- (queue is empty)';

  const debtLines = inputs.pattern_debt.patterns
    .map(
      (p) =>
        `- ${p.pattern}: debt ${p.debt_score} (${p.band})${p.days_since_last_trained !== null ? `, last trained ${p.days_since_last_trained}d ago` : ', not trained recently'}`,
    )
    .join('\n');

  const candidateLines = inputs.candidates
    .map((c) => {
      const fit = c.stack_fit
        ? `stack fit ${c.stack_fit.verdict}${c.stack_fit.reasons.length ? ` (${c.stack_fit.reasons.join(' ')})` : ''}`
        : 'stack fit n/a';
      return `- ${c.title} [program_id: ${c.program_id}] · ${c.session_count} sessions · demand ${c.systemic_demand ?? 'unrated'} · focus ${c.focus_tags.join(', ') || '(none)'} · ${fit}${c.description ? `\n  ${c.description}` : ''}`;
    })
    .join('\n');

  const historyLines = inputs.recent_history.length
    ? inputs.recent_history
        .map(
          (w) =>
            `- ${w.completed_at.slice(0, 10)} · goal ${w.goal}${w.rpe ? ` · RPE ${w.rpe}` : ''} · ${w.movements.join(', ') || '(no movements logged)'}`,
        )
        .join('\n')
    : '- (no recent workouts logged)';

  return [
    `Training goal: ${inputs.training_goal ?? '(none provided)'}`,
    `Days since last workout: ${inputs.days_since_last_workout ?? '(unknown)'}`,
    `Open program slots: ${inputs.slots_available} of 3`,
    '',
    'Active programs:',
    activeLines,
    '',
    'Queued programs (already chosen, do not re-pick):',
    queuedLines,
    '',
    `Movement-pattern balance (overall: ${inputs.pattern_debt.overall_balance}; higher debt = more undertrained):`,
    debtLines,
    '',
    'Recent workouts (most recent first):',
    historyLines,
    '',
    'Candidate programs (choose exactly one, by program_id):',
    candidateLines,
    '',
    'Recommend one program now, with mode "concurrent" or "queue".',
  ].join('\n');
}

/** Appended on a retry when the first attempt failed validation. */
export function buildCorrectionPrompt(reasons: string[]): string {
  return [
    'Your previous response was rejected for these reasons:',
    ...reasons.map((r) => `- ${r}`),
    '',
    'Produce a corrected recommendation that uses a program_id from the',
    'candidate list and a mode allowed by the rules.',
  ].join('\n');
}
