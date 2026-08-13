import { afterEach, describe, expect, test, vi } from 'vitest';

import type { Movement, Recommendation } from '~/types';
import { type MovementWeightModeFields, getWeightTabValue } from '~/utils';

import {
  RecommendationCatalog,
  buildRecommendationCatalog,
  recommendationToMovements,
  recommendationToWorkoutOptions,
} from './recommendationToMovements';

const catalogRow = (fields: Partial<Movement>): Movement => ({
  id: fields.movementName ?? 'id',
  movementName: null,
  primaryEquipment: 'Kettlebell',
  primaryItemCount: 2,
  singleOrDoubleArm: 'Double Arm',
  targetMuscleGroup: null,
  difficultyLevel: null,
  movementPattern1: null,
  patternCredits: [],
  ...fields,
});

const DOUBLE_KB_FRONT_SQUAT = 'Front Squat With Two Kettlebells';
const TWO_HAND_SWING = 'Kettlebell Swing';
const SINGLE_ARM_PRESS = 'One-Arm Kettlebell Military Press';

const catalog: RecommendationCatalog = new Map<
  string,
  MovementWeightModeFields
>([
  [
    DOUBLE_KB_FRONT_SQUAT,
    {
      primaryEquipment: 'Kettlebell',
      primaryItemCount: 2,
      singleOrDoubleArm: 'Double Arm',
    },
  ],
  [
    TWO_HAND_SWING,
    {
      primaryEquipment: 'Kettlebell',
      primaryItemCount: 1,
      singleOrDoubleArm: 'Double Arm',
    },
  ],
  [
    SINGLE_ARM_PRESS,
    {
      primaryEquipment: 'Kettlebell',
      primaryItemCount: 1,
      singleOrDoubleArm: 'Single Arm',
    },
  ],
]);

const block = (movementName: string, weightKg: number) => ({
  user_movement_id: `id-${movementName}`,
  movement_name: movementName,
  weight_kg: weightKg,
  rep_scheme: [5],
  notes: '',
});

const recommendation = (movementNames: [string, number][]): Recommendation => ({
  rationale: 'test',
  duration_minutes: 20,
  format: 'Straight Sets',
  confidence: 'high',
  blocks: movementNames.map(([name, weight]) => block(name, weight)),
});

describe('recommendationToMovements', () => {
  test('a genuine two-bell movement resolves to Double, carrying the prescribed load', () => {
    const [movement] = recommendationToMovements(
      recommendation([[DOUBLE_KB_FRONT_SQUAT, 24]]),
      catalog,
    );

    expect(movement.weightOneValue).toBe(24);
    expect(movement.weightTwoValue).toBe(24);
    expect(movement.weightTwoUnit).toBe('kilograms');
    expect(getWeightTabValue(movement)).toBe('double');
  });

  test('a one-bell two-hand movement is unaffected and resolves to 2H', () => {
    const [movement] = recommendationToMovements(
      recommendation([[TWO_HAND_SWING, 32]]),
      catalog,
    );

    expect(movement.weightOneValue).toBe(32);
    expect(movement.weightTwoValue).toBeNull();
    expect(movement.weightTwoUnit).toBeNull();
    expect(getWeightTabValue(movement)).toBe('2h');
  });

  test('a single-arm movement pins weight two to 0 and resolves to 1H', () => {
    const [movement] = recommendationToMovements(
      recommendation([[SINGLE_ARM_PRESS, 16]]),
      catalog,
    );

    expect(movement.weightOneValue).toBe(16);
    expect(movement.weightTwoValue).toBe(0);
    expect(getWeightTabValue(movement)).toBe('1h');
  });

  test('without catalog metadata the second weight stays unset (2H), matching prior behavior', () => {
    const [noCatalog] = recommendationToMovements(
      recommendation([[DOUBLE_KB_FRONT_SQUAT, 24]]),
    );
    expect(noCatalog.weightTwoValue).toBeNull();
    expect(getWeightTabValue(noCatalog)).toBe('2h');

    const [unknownMovement] = recommendationToMovements(
      recommendation([['Not In Catalog', 24]]),
      catalog,
    );
    expect(unknownMovement.weightTwoValue).toBeNull();
    expect(getWeightTabValue(unknownMovement)).toBe('2h');
  });

  test('maps each block to a movement, preserving name and rep scheme', () => {
    const movements = recommendationToMovements(
      recommendation([
        [DOUBLE_KB_FRONT_SQUAT, 24],
        [SINGLE_ARM_PRESS, 16],
      ]),
      catalog,
    );

    expect(movements).toHaveLength(2);
    expect(movements[0].movementName).toBe(DOUBLE_KB_FRONT_SQUAT);
    expect(movements[0].repScheme).toEqual([5]);
    expect(movements[1].movementName).toBe(SINGLE_ARM_PRESS);
  });
});

describe('recommendationToWorkoutOptions', () => {
  test('threads the catalog through so movements carry inferred loading modes', () => {
    const options = recommendationToWorkoutOptions(
      recommendation([[DOUBLE_KB_FRONT_SQUAT, 24]]),
      catalog,
    );

    expect(getWeightTabValue(options.movements[0])).toBe('double');
  });

  test('duration becomes a time goal for the rotating formats', () => {
    const options = recommendationToWorkoutOptions({
      ...recommendation([[DOUBLE_KB_FRONT_SQUAT, 24]]),
      format: 'Circuit',
    });

    expect(options.workoutGoal).toBe(20);
    expect(options.workoutGoalUnits).toBe('minutes');
  });

  // Straight sets stops on its set list, not the clock, so the goal is the
  // total number of sets across every block.
  test('a straight-sets recommendation goal is its total set count', () => {
    const rec = recommendation([
      [TWO_HAND_SWING, 24],
      [DOUBLE_KB_FRONT_SQUAT, 24],
    ]);
    rec.blocks[0].rep_scheme = [5, 5, 5];
    rec.blocks[1].rep_scheme = [8, 8];

    const options = recommendationToWorkoutOptions(rec);

    expect(options.workoutGoal).toBe(5);
    expect(options.workoutGoalUnits).toBe('rounds');
  });

  test.each([
    ['Straight Sets', 'straightSets'],
    ['Circuit', 'circuit'],
    ['EMOM', 'circuit'],
    ['AMRAP', 'circuit'],
    ['Ladder', 'circuit'],
  ] as const)('a %s recommendation loads as %s', (format, workoutMode) => {
    const options = recommendationToWorkoutOptions({
      ...recommendation([[TWO_HAND_SWING, 24]]),
      format,
    });

    expect(options.workoutMode).toBe(workoutMode);
  });

  test('a straight-sets recommendation with unequal rungs is exempt from the equal-rungs rule', () => {
    const rec = recommendation([
      [TWO_HAND_SWING, 24],
      [DOUBLE_KB_FRONT_SQUAT, 24],
    ]);
    rec.blocks[0].rep_scheme = [5, 4, 3, 2];
    rec.blocks[1].rep_scheme = [5, 5, 5];

    const options = recommendationToWorkoutOptions(rec);

    expect(options.workoutMode).toBe('straightSets');
  });
});

describe('buildRecommendationCatalog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('keys catalog rows by name and skips null-named rows', () => {
    const built = buildRecommendationCatalog([
      catalogRow({ movementName: DOUBLE_KB_FRONT_SQUAT }),
      catalogRow({ movementName: null }),
    ]);

    expect(built.get(DOUBLE_KB_FRONT_SQUAT)).toMatchObject({
      primaryItemCount: 2,
      singleOrDoubleArm: 'Double Arm',
    });
    expect(built.size).toBe(1);
  });

  test('warns loudly when the catalog paginated past one page', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    buildRecommendationCatalog(
      [catalogRow({ movementName: DOUBLE_KB_FRONT_SQUAT })],
      true,
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('movement catalog exceeded'),
    );
  });

  test('stays silent when a single page holds the whole catalog', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    buildRecommendationCatalog(
      [catalogRow({ movementName: DOUBLE_KB_FRONT_SQUAT })],
      false,
    );

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('recommendationToMovements — declared bell count', () => {
  const withBells = (
    movementName: string,
    weightKg: number,
    bells?: number,
  ): Recommendation => ({
    rationale: 'test',
    duration_minutes: 20,
    format: 'Straight Sets',
    confidence: 'high',
    blocks: [
      {
        ...block(movementName, weightKg),
        ...(bells === undefined ? {} : { bells }),
      },
    ],
  });

  test('bells: 2 opens the builder as Double, carrying the prescribed load', () => {
    const [movement] = recommendationToMovements(
      withBells(TWO_HAND_SWING, 24, 2),
      catalog,
    );

    expect(movement.weightOneValue).toBe(24);
    expect(movement.weightTwoValue).toBe(24);
    expect(getWeightTabValue(movement)).toBe('double');
  });

  test('bells: 1 overrides a catalog double — the recommender is authoritative', () => {
    const [movement] = recommendationToMovements(
      withBells(DOUBLE_KB_FRONT_SQUAT, 24, 1),
      catalog,
    );

    expect(getWeightTabValue(movement)).toBe('2h');
  });

  test('bells: 1 still pins a single-arm movement to 1H', () => {
    const [movement] = recommendationToMovements(
      withBells(SINGLE_ARM_PRESS, 24, 1),
      catalog,
    );

    expect(getWeightTabValue(movement)).toBe('1h');
  });

  test('blocks from before bells existed keep inferring Double from the catalog', () => {
    const [movement] = recommendationToMovements(
      withBells(DOUBLE_KB_FRONT_SQUAT, 24, undefined),
      catalog,
    );

    expect(getWeightTabValue(movement)).toBe('double');
  });
});
