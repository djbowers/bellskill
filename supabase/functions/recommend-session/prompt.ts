// recommend-session (PROD-87): prompt construction.
//
// Kept separate from transport (llm.ts) so prompt quality can be iterated in
// PROD-88 without touching the API plumbing.
import { formatEquipmentSection } from '../_shared/equipmentInput.ts';
import {
  formatModalityLine,
  formatOverallModalityBalance,
} from '../_shared/modalityPrompt.ts';
import { formatPatternLine } from '../_shared/patternDebtPrompt.ts';
import type { RecommenderInputs } from './types.ts';

export function buildSystemPrompt(hasTargets = false): string {
  const targetRules = hasTargets
    ? [
        '- The request lists "Target patterns". Your session MUST include, for',
        '  every target pattern, at least one movement whose pays list covers it.',
        '  Multi-pattern movements may cover several targets at once. Name the',
        '  patterns you are catching up in the rationale.',
      ]
    : [];
  return [
    'You are an expert kettlebell programming coach. You know the Big 6 (swing,',
    'clean, press, snatch, squat, get-up) and common protocols (Simple & Sinister,',
    'Rite of Passage), and you use bodyweight work where it serves the lifter.',
    'You design a single, focused next training session.',
    '',
    'Rules:',
    "- Choose movements ONLY from the catalog list. Copy each block's",
    '  movement_id exactly as printed in brackets on that line — never invent',
    '  an id or a movement.',
    '- Size the session to the time the lifter has and how they say they feel',
    '  today. When they are tired, sore, or short on time, scale volume down.',
    '- Prescribe weights in kilograms (whole or half kg). Start from the weights',
    '  in their recent history: hold, or move one bell size (about 4 kg) up or',
    '  down, and say why. Do not drop far below a load they handled well.',
    '- rep_scheme is the ladder for ONE round of the circuit: one positive integer',
    '  per rung. Use more than one rung only when the reps change from rung to',
    '  rung, like [1, 2, 3], [10, 8, 6] or [1, 2, 3, 2, 1]. Never repeat a rep',
    '  count on consecutive rungs — 3×5 is written [5], and the rounds come from',
    '  the clock, not from repeated rungs. Work done per side is still one rung:',
    '  one get-up each side is [1] with "each side" in the notes, never [1, 1].',
    '- adjustable_settings_kg lists the setting of each adjustable bell the',
    '  session uses, one entry per bell; leave it empty when the lifter has no',
    '  adjustable bell or no equipment is listed.',
    '- Set each block\'s "bells" to how many kettlebells are held at once.',
    '  Movements marked "double-bell" are done with 2; movements marked',
    '  "bodyweight" take no bell, so write weight_kg 0 and bells 0; every other',
    '  movement is done with 1. weight_kg is the weight of ONE bell, so a double',
    '  at 24kg means two 24kg bells, not 12kg each.',
    '- Movements marked "one leg at a time" run every rung twice, once per leg,',
    '  so they cost double the time and volume of the reps you write. Count that',
    '  when sizing the session, and avoid stacking several of them back to back.',
    '- When a pattern-balance section is provided, prefer movements that train',
    '  the red- and yellow-band (highest-score) patterns, and say so in the',
    '  rationale when it drives your selection. Readiness, recent RPE, and the',
    "  lifter's goal still take precedence when they conflict.",
    '- Patterns marked "new" have no training history yet — treat them as',
    '  neutral, not overdue; do not count them as under-trained.',
    '- A movement-mix section, when provided, is a second and WEAKER signal: it',
    '  describes how they have been moving (grind = slow strength, ballistic =',
    '  explosive, cardio = sustained effort, mobility = range of motion) rather',
    '  than which patterns they trained. Break a tie between otherwise equal',
    '  choices in favour of a red or yellow part of the mix. It never outranks',
    '  pattern balance, readiness, or their goal — and "new" means neutral here',
    '  too.',
    ...targetRules,
    '- Give a short, concrete rationale a thoughtful coach would give — tie it to',
    '  their goal, recent history, and readiness, and only to facts you were',
    '  given: never invent weeks, phases, or sessions that are not listed. Avoid',
    '  generic filler. Never use the word "debt" anywhere in the rationale or',
    '  notes — say a pattern or a kind of work is due, overdue, or needs attention.',
    '',
    'Runnability (these are checked, and a violation is rejected):',
    '- Every session is a circuit: the lifter rotates through the blocks one rung',
    '  at a time, repeating rounds until duration_minutes is up. Every block',
    '  therefore needs the SAME number of rungs, or a shorter ladder runs out',
    '  mid-round.',
    '- No rep scheme is empty, no rep count repeats on consecutive rungs, and',
    '  every rep is a whole number from 1 to 100.',
    '- Every kettlebell weight is a positive number of kilograms, no heavier than',
    '  100; a bodyweight movement is exactly 0.',
    '- duration_minutes is greater than zero.',
  ].join('\n');
}

export function buildUserPrompt(inputs: RecommenderInputs): string {
  const candidateLines = inputs.candidates
    .map(
      (c) =>
        `- ${c.name}${
          c.pattern_credits?.length
            ? ` · pays: ${c.pattern_credits.join(', ')}`
            : ''
        }${c.bodyweight ? ' · bodyweight' : ''}${
          c.supports_doubles ? ' · double-bell' : ''
        }${
          c.unilateral_lower ? ' · one leg at a time' : ''
        } [movement_id: ${c.movement_id}]`,
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
        `Pattern balance (higher score = more under-trained; overall: ${inputs.pattern_debt.overall_balance}):`,
        ...inputs.pattern_debt.patterns
          .slice()
          .sort((a, b) => {
            if (a.is_new !== b.is_new) return a.is_new ? 1 : -1;
            return b.debt_score - a.debt_score;
          })
          .map(formatPatternLine),
      ]
    : [];

  const modalitySection = inputs.modality_debt
    ? [
        '',
        `Movement mix (higher score = more under-trained; overall: ${formatOverallModalityBalance(
          inputs.modality_debt.overall_balance,
        )}):`,
        ...inputs.modality_debt.modalities
          .slice()
          .sort((a, b) => {
            if (a.is_new !== b.is_new) return a.is_new ? 1 : -1;
            return b.debt_score - a.debt_score;
          })
          .map(formatModalityLine),
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
    ...modalitySection,
    ...targetSection,
    ...equipmentSection,
    '',
    'Catalog movements (choose only from these):',
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
    'Produce a corrected recommendation that uses only catalog movement_ids,',
    'positive integer reps and weights, the same number of rungs in every block,',
    'no rep count repeated on consecutive rungs, and only weights the lifter',
    'owns — an adjustable bell keeps one setting for the whole session.',
  ].join('\n');
}
