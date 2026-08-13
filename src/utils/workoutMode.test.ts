import { WorkoutMode } from '~/types';

import { fromWorkoutMode, toWorkoutMode, usesSharedBell } from './workoutMode';

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

describe('usesSharedBell', () => {
  test.each([
    ['circuit', false, false],
    ['straightSets', false, false],
    ['circuit', true, true],
    ['straightSets', true, true],
    // Complex forces it on: the bell is never set down, so per-movement weights
    // can't be performed.
    ['complex', false, true],
    ['complex', true, true],
  ] as const)('%s + sharedBell=%s => %s', (workoutMode, sharedBell, expected) => {
    expect(usesSharedBell({ workoutMode, sharedBell })).toBe(expected);
  });

  test('legacy options with no sharedBell key fall back to the mode', () => {
    expect(usesSharedBell({ workoutMode: 'complex' })).toBe(true);
    expect(usesSharedBell({ workoutMode: 'circuit' })).toBe(false);
    expect(usesSharedBell({ workoutMode: 'complex', sharedBell: null })).toBe(
      true,
    );
  });

  test('the axis alone is enough — no mode required', () => {
    expect(usesSharedBell({ sharedBell: true })).toBe(true);
    expect(usesSharedBell({})).toBe(false);
  });
});
