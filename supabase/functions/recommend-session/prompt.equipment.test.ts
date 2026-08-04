import { describe, expect, it } from 'vitest';

import { buildUserPrompt } from './prompt.ts';
import type { RecommenderInputs } from './types.ts';

const baseInputs: RecommenderInputs = {
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
        available_weights: [
          { weight_kg: 16, doubles: true },
          { weight_kg: 24, doubles: false },
        ],
        description: '16 kg (pair), 24 kg',
      },
    });

    expect(prompt).toContain('AVAILABLE EQUIPMENT');
    expect(prompt).toContain('Loadable weights: 16kg, 24kg');
    expect(prompt).toContain('Doubles possible at: 16kg');
  });
});
