import { RpeOptions, WorkoutLog } from '~/types';

export type IntensityLevel = 0 | 1 | 2 | 3 | 4;

export const RPE_INTENSITY: Record<RpeOptions, IntensityLevel> = {
  noEffort: 0,
  easy: 1,
  ideal: 2,
  hard: 3,
  maxEffort: 4,
};

export const INTENSITY_BG: Record<IntensityLevel, string> = {
  0: 'bg-intensity-0',
  1: 'bg-intensity-1',
  2: 'bg-intensity-2',
  3: 'bg-intensity-3',
  4: 'bg-intensity-4',
};

export const INTENSITY_LABEL: Record<IntensityLevel, string> = {
  0: 'No effort',
  1: 'Easy',
  2: 'Ideal',
  3: 'Hard',
  4: 'Max effort',
};

/** A day is summarized by its hardest session; null when none were rated. */
export const hardestRpe = (workoutLogs: WorkoutLog[]): RpeOptions | null =>
  workoutLogs.reduce<RpeOptions | null>((hardest, { rpe }) => {
    if (!rpe) return hardest;
    if (!hardest) return rpe;
    return RPE_INTENSITY[rpe] > RPE_INTENSITY[hardest] ? rpe : hardest;
  }, null);
