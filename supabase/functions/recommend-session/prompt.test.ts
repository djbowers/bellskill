import { buildSystemPrompt, buildUserPrompt } from './prompt.ts';
import type { RecommenderInputs } from './types.ts';

const baseInputs = (over: Partial<RecommenderInputs> = {}): RecommenderInputs => ({
  balance_targets: [],
  training_goal: null,
  readiness: null,
  days_since_last_workout: null,
  recent_history: [],
  candidates: [
    {
      user_movement_id: 'tgu',
      name: 'Turkish Get-Up',
      is_big_6: true,
      pattern_credits: ['get_up', 'push', 'rotation'],
    },
    {
      user_movement_id: 'custom',
      name: 'Mystery Move',
      is_big_6: false,
      pattern_credits: null,
    },
  ],
  pattern_debt: null,
  modality_debt: null,
  unlocked_weights: {},
  ...over,
});

const modalityDebt = (): RecommenderInputs['modality_debt'] => ({
  overall_balance: 'grind-heavy',
  modalities: [
    {
      modality: 'grind',
      days_since_last_trained: 1,
      recent_volume_kg: 2000,
      baseline_volume_kg: 1000,
      debt_score: 5,
      band: 'green',
      hardest_rpe: null,
      is_new: false,
    },
    {
      modality: 'conditioning',
      days_since_last_trained: 21,
      recent_volume_kg: 0,
      baseline_volume_kg: 800,
      debt_score: 80,
      band: 'red',
      hardest_rpe: null,
      is_new: false,
    },
    {
      modality: 'mobility',
      days_since_last_trained: null,
      recent_volume_kg: 0,
      baseline_volume_kg: null,
      debt_score: 0,
      band: 'green',
      hardest_rpe: null,
      is_new: true,
    },
  ],
});

describe('prompt — pattern annotations and balance targets', () => {
  test('candidates carry pays annotations; unlinked ones stay bare', () => {
    const prompt = buildUserPrompt(baseInputs());
    expect(prompt).toContain(
      '- Turkish Get-Up (Big 6) · pays: get_up, push, rotation [user_movement_id: tgu]',
    );
    expect(prompt).toContain('- Mystery Move [user_movement_id: custom]');
  });

  test('balance targets render a mandatory section; absent when empty', () => {
    const withTargets = buildUserPrompt(
      baseInputs({ balance_targets: ['hinge', 'carry'] }),
    );
    expect(withTargets).toContain('Target patterns');
    expect(withTargets).toContain('hinge, carry');
    expect(buildUserPrompt(baseInputs())).not.toContain('Target patterns');
  });

  test('system prompt adds the must-cover rule only when targets exist', () => {
    expect(buildSystemPrompt(true)).toContain('Target patterns');
    expect(buildSystemPrompt(false)).not.toContain('Target patterns');
    expect(buildSystemPrompt()).not.toContain('Target patterns');
  });

  test('system prompt bans the word "debt" in rationale copy', () => {
    expect(buildSystemPrompt()).toContain('Never use');
  });
});

describe('prompt — movement mix', () => {
  test('section is omitted entirely when modality data is unavailable', () => {
    expect(buildUserPrompt(baseInputs())).not.toContain('Movement mix');
  });

  test('renders modalities worst-first, with new ones last', () => {
    const prompt = buildUserPrompt(
      baseInputs({ modality_debt: modalityDebt() }),
    );
    const mix = prompt.slice(prompt.indexOf('Movement mix'));
    expect(mix.indexOf('cardio')).toBeLessThan(mix.indexOf('- grind'));
    expect(mix.indexOf('- grind')).toBeLessThan(mix.indexOf('- mobility'));
    expect(mix).toContain('- mobility: new');
  });

  test('says cardio, never conditioning — programs use that word for something else', () => {
    const prompt = buildUserPrompt(
      baseInputs({ modality_debt: modalityDebt() }),
    );
    expect(prompt).toContain('overall: grind-heavy');
    expect(prompt).toContain('- cardio: score 80 (red)');
    expect(prompt).not.toContain('conditioning');
  });

  test('never uses the word "debt" in the rendered section', () => {
    const prompt = buildUserPrompt(
      baseInputs({ modality_debt: modalityDebt() }),
    );
    expect(prompt.slice(prompt.indexOf('Movement mix'))).not.toContain('debt');
  });

  test('system prompt ranks the mix below pattern balance, readiness and goal', () => {
    expect(buildSystemPrompt()).toContain('movement-mix section');
    expect(buildSystemPrompt()).toContain('never outranks');
  });
});
