import { describe, expect, it } from 'vitest';

import { ExampleMovementLog } from '~/examples';

import { deriveProgressionData } from './useSwingProgression';

const VARIATIONS = ['2h', '1h', 'dead-stop', 'double'] as const;

const swingLog = (
  movementName: string,
  weightKg: number,
  repScheme: number[],
  workoutLogId: number,
) =>
  new ExampleMovementLog({
    movement_name: movementName,
    weight_one_value: weightKg,
    weight_one_unit: 'kilograms',
    rep_scheme: repScheme,
    workout_log_id: workoutLogId,
  });

// Build enough logs to pass the done threshold for a given variation/weight.
// 300 reps across 10 distinct workouts: 30 reps per workout.
const doneLogsFor = (movementName: string, weightKg: number) =>
  Array.from({ length: 10 }, (_, i) =>
    swingLog(movementName, weightKg, Array(30).fill(1), i + 1),
  );

describe('deriveProgressionData', () => {
  it('zero history — each variation: 16kg=current, 20kg=next, rest locked', () => {
    const result = deriveProgressionData([]);

    for (const variation of VARIATIONS) {
      expect(result.find((n) => n.variation === variation && n.weightKg === 16)).toMatchObject({
        state: 'current',
        totalReps: 0,
        totalWorkouts: 0,
      });
      expect(result.find((n) => n.variation === variation && n.weightKg === 20)).toMatchObject({
        state: 'next',
      });
      for (const kg of [24, 28, 32]) {
        expect(result.find((n) => n.variation === variation && n.weightKg === kg)).toMatchObject({
          state: 'locked',
        });
      }
    }
  });

  it('partial progress — 2h/16kg done, 2h/20kg in progress → 20kg=current, 24kg=next', () => {
    const logs = [
      ...doneLogsFor('Kettlebell Swing', 16),
      // 2h/20kg: 150 reps, 5 workouts (below both thresholds)
      ...Array.from({ length: 5 }, (_, i) =>
        swingLog('Kettlebell Swing', 20, Array(30).fill(1), 100 + i),
      ),
    ];

    const result = deriveProgressionData(logs);
    const get2h = (kg: number) =>
      result.find((n) => n.variation === '2h' && n.weightKg === kg)!;

    expect(get2h(16).state).toBe('done');
    expect(get2h(20).state).toBe('current');
    expect(get2h(20).totalReps).toBe(150);
    expect(get2h(20).totalWorkouts).toBe(5);
    expect(get2h(24).state).toBe('next');
    expect(get2h(28).state).toBe('locked');
    expect(get2h(32).state).toBe('locked');
  });

  it('variation fully done — all 2h nodes = done', () => {
    const logs = [
      ...doneLogsFor('Kettlebell Swing', 16),
      ...doneLogsFor('Kettlebell Swing', 20),
      ...doneLogsFor('Kettlebell Swing', 24),
      ...doneLogsFor('Kettlebell Swing', 28),
      ...doneLogsFor('Kettlebell Swing', 32),
    ];

    const result = deriveProgressionData(logs);
    const twoHand = result.filter((n) => n.variation === '2h');
    expect(twoHand).toHaveLength(5);
    for (const node of twoHand) {
      expect(node.state).toBe('done');
    }
  });

  it('threshold boundaries — 299 reps + 10 workouts is not done', () => {
    // 299 reps across 10 workouts: workouts threshold met, reps not
    const logs = [
      ...Array.from({ length: 9 }, (_, i) =>
        swingLog('Kettlebell Swing', 16, Array(33).fill(1), i + 1),
      ),
      swingLog('Kettlebell Swing', 16, Array(2).fill(1), 10),
    ];

    const result = deriveProgressionData(logs);
    const node = result.find((n) => n.variation === '2h' && n.weightKg === 16)!;
    expect(node.totalReps).toBe(299);
    expect(node.totalWorkouts).toBe(10);
    expect(node.state).toBe('current');
  });

  it('threshold boundaries — 300 reps + 9 workouts is not done', () => {
    // Exactly 300 reps but only 9 distinct workouts
    const logs = Array.from({ length: 9 }, (_, i) =>
      swingLog(
        'Kettlebell Swing',
        16,
        // distribute 300 reps across 9 logs: first 3 get 34 reps, rest get 33
        i < 3 ? Array(34).fill(1) : Array(33).fill(1),
        i + 1,
      ),
    );

    const result = deriveProgressionData(logs);
    const node = result.find((n) => n.variation === '2h' && n.weightKg === 16)!;
    expect(node.totalReps).toBe(300);
    expect(node.totalWorkouts).toBe(9);
    expect(node.state).toBe('current');
  });

  it('reps from same workout are counted once toward workout total', () => {
    // Two movement_logs from the same workout_log_id
    const logs = [
      swingLog('Kettlebell Swing', 16, [10, 10], 1),
      swingLog('Kettlebell Swing', 16, [10, 10], 1),
    ];

    const result = deriveProgressionData(logs);
    const node = result.find((n) => n.variation === '2h' && n.weightKg === 16)!;
    expect(node.totalReps).toBe(40);
    expect(node.totalWorkouts).toBe(1);
  });

  it('returns 20 nodes total — 4 variations × 5 weight tiers', () => {
    const result = deriveProgressionData([]);
    expect(result).toHaveLength(20);
  });
});
