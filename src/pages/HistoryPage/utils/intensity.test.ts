import { WorkoutLog } from '~/types';

import { hardestRpe } from './intensity';

const session = (rpe: WorkoutLog['rpe']) => ({ rpe }) as WorkoutLog;

describe('hardestRpe', () => {
  test('returns null when no session was rated', () => {
    expect(hardestRpe([session(null), session(null)])).toBeNull();
  });

  test('returns null for a day with no sessions', () => {
    expect(hardestRpe([])).toBeNull();
  });

  test('takes the harder of two ratings regardless of order', () => {
    expect(hardestRpe([session('easy'), session('maxEffort')])).toBe(
      'maxEffort',
    );
    expect(hardestRpe([session('maxEffort'), session('easy')])).toBe(
      'maxEffort',
    );
  });

  test('ignores unrated sessions alongside rated ones', () => {
    expect(hardestRpe([session(null), session('hard')])).toBe('hard');
  });

  test('treats noEffort as a rating, not an absence', () => {
    expect(hardestRpe([session('noEffort')])).toBe('noEffort');
  });
});
