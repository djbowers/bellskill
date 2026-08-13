import { CuratedWorkout } from '~/types';

/**
 * Versioned seed of curated beginner workouts (PROD-158 / PROD-159). These are
 * the one-tap "recommended first workout" options shown to new users in place
 * of the blank builder. Kept as an in-app constant for v1 — structured so a
 * Supabase-backed table can replace it later without changing consumers.
 *
 * Bump CURATED_WORKOUTS_VERSION whenever the content changes so analytics can
 * attribute starts to a known revision.
 */
export const CURATED_WORKOUTS_VERSION = 3;

export const CURATED_WORKOUTS: CuratedWorkout[] = [
  {
    id: 'beginner-two-hand-swing',
    title: 'Two-Hand Swing',
    subtitle: 'Power from the hips — 50 swings to learn the hinge.',
    estimatedMinutes: 10,
    workoutOptions: {
      workoutMode: 'circuit',
      sharedBell: false,
      intervalTimer: 0,
      restTimer: 60,
      movements: [
        {
          movementName: 'Kettlebell Swing',
          repScheme: [10],
          weightOneUnit: 'kilograms',
          weightOneValue: 16,
          weightTwoUnit: null,
          weightTwoValue: null,
        },
      ],
      sharedWeightOneUnit: null,
      sharedWeightOneValue: null,
      sharedWeightTwoUnit: null,
      sharedWeightTwoValue: null,
      title: 'Beginner: Hinge Foundation',
      preWorkoutNotes: null,
      workoutGoal: 5,
      workoutGoalUnits: 'rounds',
    },
  },
  {
    id: 'beginner-overhead-press',
    title: 'Overhead Press',
    subtitle: 'Build overhead pressing strength, one arm at a time.',
    estimatedMinutes: 8,
    workoutOptions: {
      workoutMode: 'circuit',
      sharedBell: false,
      intervalTimer: 0,
      restTimer: 60,
      movements: [
        {
          movementName: 'One-Arm Kettlebell Military Press',
          repScheme: [5],
          weightOneUnit: 'kilograms',
          weightOneValue: 12,
          weightTwoUnit: null,
          // weightTwoValue: 0 encodes a single-arm (1H) hold — see getWeightTabValue.
          weightTwoValue: 0,
        },
      ],
      sharedWeightOneUnit: null,
      sharedWeightOneValue: null,
      sharedWeightTwoUnit: null,
      sharedWeightTwoValue: null,
      title: 'Beginner: Overhead Strength',
      preWorkoutNotes: null,
      workoutGoal: 5,
      workoutGoalUnits: 'rounds',
    },
  },
  {
    id: 'beginner-goblet-squat',
    title: 'Goblet Squat',
    subtitle: 'Grease the squat holding the bell at your chest.',
    estimatedMinutes: 8,
    workoutOptions: {
      workoutMode: 'circuit',
      sharedBell: false,
      intervalTimer: 0,
      restTimer: 60,
      movements: [
        {
          movementName: 'Goblet Squat',
          repScheme: [8],
          weightOneUnit: 'kilograms',
          weightOneValue: 16,
          weightTwoUnit: null,
          weightTwoValue: null,
        },
      ],
      sharedWeightOneUnit: null,
      sharedWeightOneValue: null,
      sharedWeightTwoUnit: null,
      sharedWeightTwoValue: null,
      title: 'Beginner: Squat Foundation',
      preWorkoutNotes: null,
      workoutGoal: 5,
      workoutGoalUnits: 'rounds',
    },
  },
];
