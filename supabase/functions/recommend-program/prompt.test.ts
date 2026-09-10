import { summarizeSkillTree } from '../../../src/utils/skillTreeProgress.ts';
import { buildSystemPrompt, buildUserPrompt } from './prompt.ts';
import type { RecommenderInputs } from './types.ts';

const baseInputs = (
  over: Partial<RecommenderInputs> = {},
): RecommenderInputs => ({
  training_goal: null,
  days_since_last_workout: null,
  slots_available: 3,
  active_programs: [],
  queued_programs: [],
  candidates: [
    {
      program_id: 'ss',
      title: 'Simple & Sinister',
      description: null,
      focus_tags: ['power', 'strength', 'mobility'],
      modality_profile: ['ballistic', 'grind', 'mobility'],
      systemic_demand: 'low',
      session_count: 20,
      stack_fit: null,
      skill_reach: { verdict: 'within_reach', out_of_reach_nodes: [] },
    },
    {
      program_id: 'custom',
      title: 'Someone’s Own Program',
      description: null,
      focus_tags: [],
      modality_profile: [],
      systemic_demand: null,
      session_count: 8,
      stack_fit: null,
      skill_reach: { verdict: 'within_reach', out_of_reach_nodes: [] },
    },
  ],
  pattern_debt: { overall_balance: 'balanced', patterns: [] },
  modality_debt: null,
  recent_history: [],
  equipment: null,
  skill_tree: null,
  ...over,
});

const modalityDebt = (): RecommenderInputs['modality_debt'] => ({
  overall_balance: 'conditioning-heavy',
  modalities: [
    {
      modality: 'grind',
      days_since_last_trained: 24,
      recent_volume_kg: 0,
      baseline_volume_kg: 1200,
      debt_score: 85,
      band: 'red',
      is_new: false,
    },
    {
      modality: 'conditioning',
      days_since_last_trained: 1,
      recent_volume_kg: 4000,
      baseline_volume_kg: 2000,
      debt_score: 3,
      band: 'green',
      is_new: false,
    },
  ],
});

describe('recommend-program prompt — the two program axes', () => {
  test('labels focus and modality distinctly rather than as bare tag lists', () => {
    const prompt = buildUserPrompt(baseInputs());
    expect(prompt).toContain(
      'trains for: power, strength, mobility · movement mix: ballistic, grind, mobility',
    );
  });

  test('drops the movement-mix clause when nothing matched the catalog', () => {
    const prompt = buildUserPrompt(baseInputs());
    const line = prompt
      .split('\n')
      .find((l) => l.includes('Someone’s Own Program'));
    expect(line).toContain('trains for: (none)');
    expect(line).not.toContain('movement mix');
  });

  test('renders an active program on both axes too', () => {
    const prompt = buildUserPrompt(
      baseInputs({
        active_programs: [
          {
            program_id: 'dfw',
            title: 'Dry Fighting Weight',
            focus_tags: ['strength', 'hypertrophy'],
            modality_profile: ['grind', 'ballistic'],
            systemic_demand: 'high',
            progress: '4/30',
            last_worked_at: null,
          },
        ],
      }),
    );
    expect(prompt).toContain(
      'trains for: strength, hypertrophy · movement mix: grind, ballistic',
    );
  });
});

describe('recommend-program prompt — movement-mix balance', () => {
  test('section is omitted when modality data is unavailable', () => {
    expect(buildUserPrompt(baseInputs())).not.toContain('Movement-mix balance');
  });

  test('renders the under-trained modality first, translated to cardio', () => {
    const prompt = buildUserPrompt(
      baseInputs({ modality_debt: modalityDebt() }),
    );
    const mix = prompt.slice(prompt.indexOf('Movement-mix balance'));
    expect(mix).toContain('overall: cardio-heavy');
    expect(mix.indexOf('- grind')).toBeLessThan(mix.indexOf('- cardio'));
  });

  test('never leaks the modality word "conditioning", which focus tags also use', () => {
    const prompt = buildUserPrompt(
      baseInputs({ modality_debt: modalityDebt() }),
    );
    const mix = prompt.slice(prompt.indexOf('Movement-mix balance'));
    expect(mix).not.toContain('conditioning');
  });
});

describe('recommend-program prompt — system rules', () => {
  test('no longer tells the model to match focus tags against movement patterns', () => {
    // The two vocabularies are disjoint, so that instruction was unfollowable.
    expect(buildSystemPrompt()).not.toMatch(
      /focus tags pay down the undertrained movement/i,
    );
  });

  test('points tag matching at the movement mix and separates the axes', () => {
    const rules = buildSystemPrompt();
    expect(rules).toMatch(/not\s+interchangeable/i);
    expect(rules).toMatch(/whose movement mix covers the under-trained/i);
    expect(rules).toMatch(/cardio is/i);
  });

  test('keeps the stack-fit and neutral-new rules', () => {
    const rules = buildSystemPrompt();
    expect(rules).toMatch(/stack-fit verdict/i);
    expect(rules).toMatch(/neutral, not undertrained/i);
  });
});

describe('recommend-program prompt — skill tree', () => {
  const beginner = summarizeSkillTree([
    { nodeId: 'L1-N2', status: 'complete', completedAt: '2026-09-01T00:00:00Z' },
    { nodeId: 'L2-N2', status: 'active', completedAt: null },
  ]);
  const withTree = () =>
    baseInputs({
      skill_tree: beginner,
      candidates: [
        {
          ...baseInputs().candidates[0],
          skill_reach: { verdict: 'within_reach', out_of_reach_nodes: [] },
        },
        {
          ...baseInputs().candidates[1],
          title: 'Armor Building Complex',
          skill_reach: {
            verdict: 'stretch',
            out_of_reach_nodes: ['L7-N1', 'L7-N2'],
          },
        },
      ],
    });

  test('omits the section and the reach clause without a tree', () => {
    const prompt = buildUserPrompt(baseInputs());
    expect(prompt).not.toContain('SKILL TREE');
    expect(prompt).not.toContain('within reach');
    expect(buildSystemPrompt()).not.toContain('skill-tree');
  });

  test('renders the section and each candidate reach verdict', () => {
    const prompt = buildUserPrompt(withTree());
    expect(prompt).toContain('SKILL TREE');
    expect(prompt).toContain('Practising now:\n- Two-hand swing (First load)');
    expect(prompt).toContain('Simple & Sinister [program_id: ss]');
    expect(prompt).toMatch(/Simple & Sinister .* · skills within reach/);
    expect(prompt).toMatch(
      /Armor Building Complex .* · stretches beyond the lifter's frontier \(Double clean, Double front squat\)/,
    );
    expect(prompt).not.toMatch(/debt|locked/i);
  });

  test('system prompt adds the reach rule only when a tree exists', () => {
    expect(buildSystemPrompt(true)).toContain('stretch pick is acceptable only');
    expect(buildSystemPrompt(false)).not.toContain('stretch pick');
  });
});
