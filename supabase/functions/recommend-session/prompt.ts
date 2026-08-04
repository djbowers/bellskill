// recommend-session (PROD-87): prompt construction.
//
// Kept separate from transport (llm.ts) so prompt quality can be iterated in
// PROD-88 without touching the API plumbing.

import type { RecommendMode, RecommenderInputs } from './types.ts';
import { formatEquipmentSection } from '../_shared/equipmentInput.ts';
import { formatPatternLine } from '../_shared/patternDebtPrompt.ts';

export function buildSystemPrompt(mode: RecommendMode = 'default'): string {
  const balanceRules =
    mode === 'balance'
      ? [
          '- BALANCE MODE: the request lists "Target patterns". Your session MUST',
          "  include, for every target pattern, at least one movement whose pays",
          '  list covers it. Multi-pattern movements may cover several targets at',
          '  once. Name the patterns you are catching up in the rationale.',
        ]
      : [];
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
    '- When a pattern-balance section is provided, prefer movements that train',
    '  the red- and yellow-band (highest-debt) patterns, and say so in the',
    '  rationale when it drives your selection. Readiness, recent RPE, and the',
    "  lifter's goal still take precedence when they conflict.",
    "- Patterns marked \"new\" have no training history yet — treat them as",
    '  neutral, not overdue; do not count them toward pattern debt.',
    ...balanceRules,
    '- Give a short, concrete rationale a thoughtful coach would give — tie it to',
    '  their goal, recent history, and readiness. Avoid generic filler. Never use',
    '  the word "debt" — say a pattern is due, overdue, or needs attention.',
    '',
    'Runnability (these are checked, and a violation is rejected):',
    '- Every movement needs the SAME number of rungs, unless you declare the format',
    '  "Straight Sets". Every other format rotates through the movements one rung at',
    '  a time, so a shorter ladder runs out mid-round. Either match the rung counts',
    '  across every block or declare "Straight Sets".',
    '- No rep scheme is empty, and every rep is a whole number from 1 to 100.',
    '- Every weight is a positive number of kilograms, no heavier than 100.',
    '- duration_minutes is greater than zero.',
  ].join('\n');
}

export function buildUserPrompt(inputs: RecommenderInputs): string {
  const candidateLines = inputs.candidates
    .map(
      (c) =>
        `- ${c.name}${c.is_big_6 ? ' (Big 6)' : ''}${
          c.pattern_credits?.length
            ? ` · pays: ${c.pattern_credits.join(', ')}`
            : ''
        } [user_movement_id: ${c.user_movement_id}]`,
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

  const patternDebtSection = inputs.pattern_debt
    ? [
        '',
        `Pattern balance (higher debt = more under-trained; overall: ${inputs.pattern_debt.overall_balance}):`,
        ...inputs.pattern_debt.patterns
          .slice()
          .sort((a, b) => {
            if (a.is_new !== b.is_new) return a.is_new ? 1 : -1;
            return b.debt_score - a.debt_score;
          })
          .map(formatPatternLine),
      ]
    : [];

  const targetSection = inputs.balance_targets.length
    ? [
        '',
        `Target patterns (every one MUST be trained by at least one movement): ${inputs.balance_targets.join(', ')}`,
      ]
    : [];

  const equipmentText = formatEquipmentSection(
    'description' in inputs.unlocked_weights ? inputs.unlocked_weights : null,
  );
  const equipmentSection = equipmentText ? ['', equipmentText] : [];

  return [
    `Training goal: ${inputs.training_goal ?? '(none provided)'}`,
    `How they feel today: ${inputs.readiness ?? '(not provided)'}`,
    `Days since last workout: ${inputs.days_since_last_workout ?? '(unknown)'}`,
    '',
    'Recent workouts (most recent first):',
    historyLines,
    ...patternDebtSection,
    ...targetSection,
    ...equipmentSection,
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
    'Produce a corrected recommendation that uses only candidate user_movement_ids,',
    'positive integer reps and weights, and rung counts that match across every',
    'block unless the format is "Straight Sets".',
  ].join('\n');
}
