import type { RecommendationLike } from './recommendationDraft';
import { formatToWorkoutMode, recommendationToDraft } from './recommendationDraft';
import { validateWorkout } from './validateWorkout';

const recommendation = (
  over: Partial<RecommendationLike> = {},
): RecommendationLike => ({
  duration_minutes: 20,
  format: 'Circuit',
  blocks: [
    { movement_name: 'Swing', weight_kg: 24, rep_scheme: [10, 10, 10] },
    { movement_name: 'Goblet Squat', weight_kg: 16, rep_scheme: [5, 5, 5] },
  ],
  ...over,
});

describe('formatToWorkoutMode', () => {
  test.each([
    ['Straight Sets', 'straightSets'],
    ['Circuit', 'circuit'],
    ['EMOM', 'circuit'],
    ['AMRAP', 'circuit'],
    ['Ladder', 'circuit'],
  ])('maps %s onto %s', (format, mode) => {
    expect(formatToWorkoutMode(format)).toBe(mode);
  });

  test('an unknown format falls back to circuit', () => {
    expect(formatToWorkoutMode('Tabata')).toBe('circuit');
  });
});

describe('recommendationToDraft', () => {
  test('maps duration, blocks, and weights onto the draft shape', () => {
    expect(recommendationToDraft(recommendation())).toEqual({
      workoutMode: 'circuit',
      workoutGoal: 20,
      intervalTimer: 0,
      movements: [
        { movementName: 'Swing', repScheme: [10, 10, 10], weightOneValue: 24 },
        {
          movementName: 'Goblet Squat',
          repScheme: [5, 5, 5],
          weightOneValue: 16,
        },
      ],
    });
  });

  test('the 2026-08-04 recommendation: 4/3/3 rungs in a circuit is unrunnable', () => {
    const draft = recommendationToDraft(
      recommendation({
        blocks: [
          { movement_name: 'A', weight_kg: 16, rep_scheme: [1, 2, 3, 4] },
          { movement_name: 'B', weight_kg: 16, rep_scheme: [5, 5, 5] },
          { movement_name: 'C', weight_kg: 16, rep_scheme: [5, 5, 5] },
        ],
      }),
    );
    expect(validateWorkout(draft).errors.map((e) => e.code)).toEqual([
      'unequal_rungs',
    ]);
  });

  test('the same blocks declared as Straight Sets are runnable', () => {
    const draft = recommendationToDraft(
      recommendation({
        format: 'Straight Sets',
        blocks: [
          { movement_name: 'A', weight_kg: 16, rep_scheme: [1, 2, 3, 4] },
          { movement_name: 'B', weight_kg: 16, rep_scheme: [5, 5, 5] },
        ],
      }),
    );
    expect(validateWorkout(draft).errors).toEqual([]);
  });
});
