import { WorkoutMode } from '~/types';

import { fromWorkoutMode, toWorkoutMode } from './workoutMode';

describe('toWorkoutMode', () => {
  test.each([
    [false, false, 'circuit'],
    [false, true, 'straightSets'],
    [true, false, 'complex'],
    // Corrupt row: the builder has always kept these mutually exclusive.
    [true, true, 'complex'],
  ] as const)('%s / %s reads as %s', (complexSet, straightSets, expected) => {
    expect(toWorkoutMode(complexSet, straightSets)).toBe(expected);
  });

  test('absent columns read as circuit', () => {
    expect(toWorkoutMode()).toBe('circuit');
    expect(toWorkoutMode(null, null)).toBe('circuit');
  });
});

describe('fromWorkoutMode', () => {
  test.each([
    ['circuit', { complexSet: false, straightSets: false }],
    ['straightSets', { complexSet: false, straightSets: true }],
    ['complex', { complexSet: true, straightSets: false }],
  ] as const)('%s writes %o', (mode, expected) => {
    expect(fromWorkoutMode(mode)).toEqual(expected);
  });
});

describe('round trip', () => {
  test.each(['circuit', 'straightSets', 'complex'] as const)(
    '%s survives a write/read cycle',
    (mode: WorkoutMode) => {
      const { complexSet, straightSets } = fromWorkoutMode(mode);
      expect(toWorkoutMode(complexSet, straightSets)).toBe(mode);
    },
  );
});
