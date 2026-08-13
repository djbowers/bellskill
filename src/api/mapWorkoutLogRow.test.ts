import { ExampleWorkoutLog } from '~/examples';

import { mapWorkoutLogRow } from './mapWorkoutLogRow';

type Row = Parameters<typeof mapWorkoutLogRow>[0];

const row = (overrides: Partial<Row>): Row =>
  ({ ...new ExampleWorkoutLog({}), ...overrides }) as Row;

describe('mapWorkoutLogRow', () => {
  test('reads the new columns when present', () => {
    const log = mapWorkoutLogRow(
      row({ workout_mode: 'circuit', shared_bell: true }),
    );

    expect(log.workoutMode).toBe('circuit');
    expect(log.sharedBell).toBe(true);
  });

  test('falls back to the legacy pair for a row written pre-migration', () => {
    const log = mapWorkoutLogRow(
      row({ workout_mode: null, shared_bell: null, complex_set: true }),
    );

    expect(log.workoutMode).toBe('complex');
    expect(log.sharedBell).toBe(true);
  });

  test('a legacy straight-sets row is not a shared-bell workout', () => {
    const log = mapWorkoutLogRow(
      row({
        workout_mode: null,
        shared_bell: null,
        complex_set: false,
        straight_sets: true,
      }),
    );

    expect(log.workoutMode).toBe('straightSets');
    expect(log.sharedBell).toBe(false);
  });
});
