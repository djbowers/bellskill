// recommend-program: prompt construction.
//
// Kept separate from transport (llm.ts) so prompt quality can be iterated
// without touching the API plumbing.

import type { CandidateProgram, RecommenderInputs } from './types.ts';
import { formatEquipmentSection } from '../_shared/equipmentInput.ts';
import {
  formatModalityLine,
  formatOverallModalityBalance,
  modalityWord,
} from '../_shared/modalityPrompt.ts';
import { formatPatternLine } from '../_shared/patternDebtPrompt.ts';
import {
  formatNodeTitles,
  formatSkillTreeSection,
} from '../_shared/skillTreeInput.ts';

/**
 * Both program axes, disambiguated. `conditioning` and `mobility` are values in
 * the focus vocabulary AND the modality one, meaning different things — what a
 * prescription buys versus how a rep moves you — so the two are never rendered
 * as bare tag lists side by side. The movement-mix clause is dropped entirely
 * when nothing the program prescribes matched the catalog.
 */
const formatProgramAxes = (
  program: Pick<CandidateProgram, 'focus_tags' | 'modality_profile'>,
): string => {
  const focus = `trains for: ${program.focus_tags.join(', ') || '(none)'}`;
  if (program.modality_profile.length === 0) return focus;
  return `${focus} · movement mix: ${program.modality_profile
    .map(modalityWord)
    .join(', ')}`;
};

/** ` · skills within reach` or the stretch clause; '' when the lifter has no tree. */
const formatSkillReach = (
  candidate: Pick<CandidateProgram, 'skill_reach'>,
  hasSkillTree: boolean,
): string => {
  if (!hasSkillTree) return '';
  const { verdict, out_of_reach_nodes } = candidate.skill_reach;
  return verdict === 'within_reach'
    ? ' · skills within reach'
    : ` · stretches beyond the lifter's frontier (${formatNodeTitles(out_of_reach_nodes)})`;
};

export function buildSystemPrompt(hasSkillTree = false): string {
  const skillTreeRules = hasSkillTree
    ? [
        '- The skill-tree section is where the lifter stands on the map, and each',
        "  candidate says whether the skills its sessions practise are within the",
        "  lifter's reach or stretch beyond their frontier. Prefer a within-reach",
        '  candidate; a stretch pick is acceptable only when no candidate is within',
        '  reach, and then the rationale must say which skills it would stretch.',
      ]
    : [];
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
    '- Programs are described on two different axes, and they are not',
    '  interchangeable. "Trains for" is the adaptation the prescription buys',
    '  (strength, endurance, skill). "Movement mix" is how its movements move the',
    '  lifter — grind is slow strength, ballistic is explosive, cardio is',
    '  sustained effort, mobility is range of motion — and it is the axis that',
    '  lines up with the lifter\'s own movement-mix balance below.',
    '- Prefer candidates whose movement mix covers the under-trained parts of the',
    '  lifter\'s mix, and whose "trains for" tags serve their stated goal. Use the',
    '  pattern balance to judge whether a candidate fills a real gap, and name',
    '  what it catches up in the rationale. Anything marked "new" has no training',
    '  history yet — treat it as neutral, not undertrained.',
    '- Respect the precomputed stack-fit verdicts: mode "concurrent" is allowed',
    '  only when slots_available > 0 AND that candidate\'s stack-fit verdict is',
    '  not "conflict". Otherwise use mode "queue".',
    '- If the lifter has no active programs, use mode "concurrent".',
    ...skillTreeRules,
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
            `- ${p.title} · ${p.progress} sessions done · demand ${p.systemic_demand ?? 'unrated'} · ${formatProgramAxes(p)}${p.last_worked_at ? ` · last worked ${p.last_worked_at.slice(0, 10)}` : ''}`,
        )
        .join('\n')
    : '- (no active programs)';

  const queuedLines = inputs.queued_programs.length
    ? inputs.queued_programs.map((p) => `- ${p.title}`).join('\n')
    : '- (queue is empty)';

  const debtLines = inputs.pattern_debt.patterns.map(formatPatternLine).join('\n');

  const hasSkillTree = inputs.skill_tree !== null;
  const candidateLines = inputs.candidates
    .map((c) => {
      const fit = c.stack_fit
        ? `stack fit ${c.stack_fit.verdict}${c.stack_fit.reasons.length ? ` (${c.stack_fit.reasons.join(' ')})` : ''}`
        : 'stack fit n/a';
      return `- ${c.title} [program_id: ${c.program_id}] · ${c.session_count} sessions · demand ${c.systemic_demand ?? 'unrated'} · ${formatProgramAxes(c)} · ${fit}${formatSkillReach(c, hasSkillTree)}${c.description ? `\n  ${c.description}` : ''}`;
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

  const modalitySection = inputs.modality_debt
    ? [
        '',
        `Movement-mix balance (overall: ${formatOverallModalityBalance(
          inputs.modality_debt.overall_balance,
        )}; higher score = more under-trained):`,
        ...inputs.modality_debt.modalities
          .slice()
          .sort((a, b) => {
            if (a.is_new !== b.is_new) return a.is_new ? 1 : -1;
            return b.debt_score - a.debt_score;
          })
          .map(formatModalityLine),
      ]
    : [];

  const equipmentText = formatEquipmentSection(inputs.equipment);
  const equipmentSection = equipmentText ? ['', equipmentText] : [];

  const skillTreeText = formatSkillTreeSection(inputs.skill_tree);
  const skillTreeSection = skillTreeText ? ['', skillTreeText] : [];

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
    `Movement-pattern balance (overall: ${inputs.pattern_debt.overall_balance}; higher score = more undertrained):`,
    debtLines,
    ...modalitySection,
    '',
    'Recent workouts (most recent first):',
    historyLines,
    ...equipmentSection,
    ...skillTreeSection,
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
    'candidate list, a mode allowed by the rules, and a candidate whose skills',
    'are within reach when one exists.',
  ].join('\n');
}
