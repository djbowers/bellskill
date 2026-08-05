import { describe, expect, it } from 'vitest';

import { buildUserPrompt } from './prompt.ts';
import type { RecommenderInputs } from './types.ts';

const baseInputs: RecommenderInputs = {
  mode: 'default',
  balance_targets: [],
  training_goal: 'strength',
  readiness: 'fresh',
  days_since_last_workout: 2,
  recent_history: [],
  candidates: [
    { user_movement_id: 'm-1', name: 'Kettlebell Swing', is_big_6: true },
  ],
  pattern_debt: null,
  unlocked_weights: {},
};

describe('recommend-session prompt equipment section', () => {
  it('omits the section when no equipment is recorded', () => {
    const prompt = buildUserPrompt(baseInputs);

    expect(prompt).not.toContain('AVAILABLE EQUIPMENT');
  });

  it('constrains weights to the loadable list when equipment is recorded', () => {
    const prompt = buildUserPrompt({
      ...baseInputs,
      unlocked_weights: {
        fixed_weights: [
          { weight_kg: 16, count: 2, doubles: true },
          { weight_kg: 24, count: 1, doubles: false },
        ],
        adjustable_bells: [],
        adjustable_bell_count: 0,
        description: '16 kg (pair), 24 kg',
      },
    });

    expect(prompt).toContain('AVAILABLE EQUIPMENT');
    expect(prompt).toContain(
      'Fixed bells, usable at any point in the session: 16kg (pair — doubles OK), 24kg',
    );
  });

  it('tells the recommender an adjustable bell is set once per session', () => {
    const prompt = buildUserPrompt({
      ...baseInputs,
      unlocked_weights: {
        fixed_weights: [],
        adjustable_bells: [{ count: 2, settings_kg: [12, 16, 20] }],
        adjustable_bell_count: 2,
        description: 'adjustable 12–20 kg (×2, 4 kg steps)',
      },
    });

    expect(prompt).toContain('holds ONE setting for the entire session');
    expect(prompt).toContain('Use at most 2 distinct adjustable weights');
  });
});
