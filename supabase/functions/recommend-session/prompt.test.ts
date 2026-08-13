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
  unlocked_weights: {},
  ...over,
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
