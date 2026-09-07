import type { RecommendationLike } from './recommendationDraft';
import {
  recommendationGoal,
  recommendationToDraft,
} from './recommendationDraft';
import { validateWorkout } from './validateWorkout';

const recommendation = (
  over: Partial<RecommendationLike> = {},
): RecommendationLike => ({
  duration_minutes: 20,
  format: 'Circuit',
  blocks: [
    { movement_name: 'Swing', weight_kg: 24, rep_scheme: [10] },
    { movement_name: 'Goblet Squat', weight_kg: 16, rep_scheme: [5] },
  ],
  ...over,
});

describe('recommendationGoal', () => {
  test('a circuit runs on the clock', () => {
    expect(recommendationGoal(recommendation())).toEqual({
      workoutGoal: 20,
      workoutGoalUnits: 'minutes',
    });
  });
});

describe('recommendationToDraft', () => {
  test('maps duration, blocks, and weights onto a circuit draft', () => {
    expect(recommendationToDraft(recommendation())).toEqual({
      workoutMode: 'circuit',
      workoutGoal: 20,
      intervalTimer: 0,
      movements: [
        { movementName: 'Swing', repScheme: [10], weightOneValue: 24 },
        { movementName: 'Goblet Squat', repScheme: [5], weightOneValue: 16 },
      ],
    });
  });

  test('the 2026-08-04 recommendation: 4/3/3 rungs in a circuit is unrunnable', () => {
    const draft = recommendationToDraft(
      recommendation({
        blocks: [
          { movement_name: 'A', weight_kg: 16, rep_scheme: [1, 2, 3, 4] },
          { movement_name: 'B', weight_kg: 16, rep_scheme: [5, 4, 3] },
          { movement_name: 'C', weight_kg: 16, rep_scheme: [5, 4, 3] },
        ],
      }),
    );
    expect(validateWorkout(draft).errors.map((e) => e.code)).toEqual([
      'unequal_rungs',
    ]);
  });

  test('a format other than Circuit still maps onto a circuit', () => {
    const draft = recommendationToDraft(
      recommendation({ format: 'Straight Sets' }),
    );
    expect(draft.workoutMode).toBe('circuit');
  });
});
