import { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import {
  DEFAULT_MOVEMENT_OPTIONS,
  DEFAULT_WORKOUT_OPTIONS,
  SessionProvider,
  WorkoutOptionsContext,
} from '~/contexts';
import { MovementOptions, WorkoutOptions } from '~/types';

import { ActiveWorkoutPage } from './ActiveWorkoutPage';

const defaultWorkoutOptions: WorkoutOptions = {
  ...DEFAULT_WORKOUT_OPTIONS,
  movements: [
    { ...DEFAULT_MOVEMENT_OPTIONS, movementName: 'Kettlebell Clean and Press' },
  ],
  title: 'Example Workout',
  preWorkoutNotes: 'Example pre-workout notes',
};

const meta = {
  component: ActiveWorkoutPage,
  args: {
    defaultPaused: false,
  },
  decorators: [
    (Story, { parameters }) => (
      <WorkoutOptionsContext.Provider
        value={[
          {
            ...defaultWorkoutOptions,
            ...parameters.workoutOptions,
          },
          () => {},
        ]}
      >
        <Story />
      </WorkoutOptionsContext.Provider>
    ),
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
    (Story) => (
      <SessionProvider
        value={{
          user: {
            id: '123',
            app_metadata: {},
            user_metadata: {},
            created_at: '',
            aud: '',
          },
          access_token: '',
          refresh_token: '',
          expires_in: 10000,
          token_type: '',
        }}
      >
        <Story />
      </SessionProvider>
    ),
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof ActiveWorkoutPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DoubleWeights: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Double Front Squat',
          weightOneValue: 20,
          weightOneUnit: 'kilograms',
          weightTwoValue: 20,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const OneHanded: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Single Arm Front Squat',
          weightOneValue: 20,
          weightOneUnit: 'kilograms',
          weightTwoValue: 0,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const TwoHanded: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Goblet Squat',
          weightOneValue: 20,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const RepLadders: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Push-Ups',
          repScheme: [1, 2, 3],
          weightOneValue: null,
          weightOneUnit: null,
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const MixedWeights: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Clean and Press',
          weightOneValue: 20,
          weightOneUnit: 'kilograms',
          weightTwoValue: 16,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const MultipleMovements: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Clean and Press',
          weightOneValue: 20,
          weightOneUnit: 'kilograms',
          weightTwoValue: 20,
          weightTwoUnit: 'kilograms',
        },
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Front Squat',
          weightOneValue: 20,
          weightOneUnit: 'kilograms',
          weightTwoValue: 20,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const MultipleMovementsAndMixedWeights: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Clean and Press',
          weightOneValue: 20,
          weightOneUnit: 'kilograms',
          weightTwoValue: 16,
          weightTwoUnit: 'kilograms',
        },
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Front Squat',
          weightOneValue: 20,
          weightOneUnit: 'kilograms',
          weightTwoValue: 16,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const BodyweightMovements: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Push-Ups',
          weightOneValue: null,
          weightOneUnit: null,
          weightTwoValue: null,
          weightTwoUnit: null,
        },
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Pull-Ups',
          weightOneValue: null,
          weightOneUnit: null,
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const IntervalTimer: Story = {
  parameters: {
    workoutOptions: {
      intervalTimer: 30,
    },
  },
};

// Mirrors a seeded A+A Protocol "Plan A" session at the program's 30-minute
// target: single-KB one-arm clean & jerk, EMOM-paced at a 30s interval so
// consecutive auto-fires alternate hands (left on the minute, right 30s later).
// First shipped program to use intervalTimer.
export const AAProtocolPlanASession: Story = {
  parameters: {
    workoutOptions: {
      intervalTimer: 30,
      restTimer: 0,
      workoutMode: 'circuit',
      workoutGoal: 30,
      workoutGoalUnits: 'minutes',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'One-Arm Kettlebell Clean and Jerk',
          repScheme: [1],
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: 0,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

// A+A Protocol "Plan A" stage 2+ (PROD-245): a SINGLE-arm complex under EMOM.
// The whole Clean + Jerk chain is done on one hand, then the next interval fires
// it on the other — left on the minute, right 30s later — while volume sums
// across every movement. Single bell (weightTwoValue 0 / sharedWeightTwoValue 0)
// is what distinguishes this from the two-hand and double-bell complexes, which
// do not alternate sides.
export const SingleArmComplexEMOM: Story = {
  parameters: {
    workoutOptions: {
      workoutMode: 'complex',
      intervalTimer: 30,
      restTimer: 0,
      workoutGoal: 30,
      workoutGoalUnits: 'minutes',
      sharedWeightOneValue: 24,
      sharedWeightOneUnit: 'kilograms',
      sharedWeightTwoValue: 0,
      sharedWeightTwoUnit: 'kilograms',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'One-Arm Kettlebell Clean',
          repScheme: [1],
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: 0,
          weightTwoUnit: 'kilograms',
        },
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'One-Arm Kettlebell Jerk',
          repScheme: [1],
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: 0,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

// Timed movements (PROD-200) — the Kettlebell Mile seed's shape: a single
// one-handed suitcase carry on ONE 60-second rung, with rounds as the
// progression lever (week 1 is 3 rounds = 6 min under load). One-handed loading
// (weightTwoValue 0) makes the runtime mirror the rung per hand, which is
// exactly the source's "switch hands as often as you want," so one round is
// 1:00 left + 1:00 right.
export const KettlebellMileSession: Story = {
  parameters: {
    workoutOptions: {
      intervalTimer: 0,
      restTimer: 0,
      workoutMode: 'circuit',
      workoutGoal: 3,
      workoutGoalUnits: 'rounds',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Kettlebell Suitcase Carry',
          repScheme: [60],
          timedRungs: true,
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: 0,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

// Rungs of differing length prove the countdown is re-armed per rung rather
// than reusing the first rung's duration for the whole movement.
export const TimedRungsVaryingDurations: Story = {
  parameters: {
    workoutOptions: {
      intervalTimer: 0,
      restTimer: 0,
      workoutGoal: 10,
      workoutGoalUnits: 'rounds',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Kettlebell Suitcase Carry',
          repScheme: [30, 60],
          timedRungs: true,
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

// A kilograms-goal workout containing a timed movement: seconds must not be
// multiplied by load, or the goal would be met before the first carry ends.
export const TimedRungsVolumeGoal: Story = {
  parameters: {
    workoutOptions: {
      intervalTimer: 0,
      restTimer: 0,
      workoutGoal: 1000,
      workoutGoalUnits: 'kilograms',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Kettlebell Suitcase Carry',
          repScheme: [120],
          timedRungs: true,
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const RestTimer: Story = {
  parameters: {
    workoutOptions: {
      restTimer: 30,
    },
  },
};

export const IntervalRestTimer: Story = {
  parameters: {
    workoutOptions: {
      intervalTimer: 5,
      restTimer: 5,
    },
  },
};

export const WorkoutGoalRounds: Story = {
  parameters: {
    workoutOptions: {
      workoutGoal: 10,
      workoutGoalUnits: 'rounds',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Clean and Press',
          weightOneValue: 20,
          weightOneUnit: 'kilograms',
          weightTwoValue: 20,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const WeightUnitsPounds: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: '1H Club Mill',
          weightOneValue: 15,
          weightOneUnit: 'pounds',
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const SingleWeight24Kg: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Goblet Squat',
          repScheme: [5],
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const DoubleWeights16And12Kg: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Double Front Squat',
          repScheme: [5],
          weightOneValue: 16,
          weightOneUnit: 'kilograms',
          weightTwoValue: 12,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const SingleWeight53Lb: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Goblet Squat',
          repScheme: [5],
          weightOneValue: 53,
          weightOneUnit: 'pounds',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const MixedUnits16KgAnd26_5Lb: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Double Front Squat',
          repScheme: [5],
          weightOneValue: 16,
          weightOneUnit: 'kilograms',
          weightTwoValue: 26.5,
          weightTwoUnit: 'pounds',
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const MixedUnits35LbAnd12Kg: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Double Front Squat',
          repScheme: [5],
          weightOneValue: 35,
          weightOneUnit: 'pounds',
          weightTwoValue: 12,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const OneHanded16Kg: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Single Arm Front Squat',
          repScheme: [5],
          weightOneValue: 16,
          weightOneUnit: 'kilograms',
          weightTwoValue: 0,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const RepLadder16Kg: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Goblet Squat',
          repScheme: [1, 2, 3],
          weightOneValue: 16,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const VolumeGoalExactMatch: Story = {
  parameters: {
    workoutOptions: {
      workoutGoal: 120,
      workoutGoalUnits: 'kilograms',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Goblet Squat',
          repScheme: [5],
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const VolumeGoalExceeded: Story = {
  parameters: {
    workoutOptions: {
      workoutGoal: 100,
      workoutGoalUnits: 'kilograms',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Goblet Squat',
          repScheme: [5],
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const VolumeGoalWithDecimalRounding: Story = {
  parameters: {
    workoutOptions: {
      workoutGoal: 200,
      workoutGoalUnits: 'kilograms',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Goblet Squat',
          repScheme: [5],
          weightOneValue: 24.08,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const VolumeGoalWithDecimalRoundingUp: Story = {
  parameters: {
    workoutOptions: {
      workoutGoal: 200,
      workoutGoalUnits: 'kilograms',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Goblet Squat',
          repScheme: [5],
          weightOneValue: 24.12,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const MinutesGoalHighVolume: Story = {
  parameters: {
    workoutOptions: {
      workoutGoal: 10,
      workoutGoalUnits: 'minutes',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Goblet Squat',
          repScheme: [5],
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const RoundsGoalHighVolume: Story = {
  parameters: {
    workoutOptions: {
      workoutGoal: 10,
      workoutGoalUnits: 'rounds',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Goblet Squat',
          repScheme: [5],
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const ZeroWeightValues: Story = {
  parameters: {
    workoutOptions: {
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Test Movement',
          repScheme: [5],
          weightOneValue: 0,
          weightOneUnit: 'kilograms',
          weightTwoValue: 0,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const VeryLargeVolumeGoal: Story = {
  parameters: {
    workoutOptions: {
      workoutGoal: 10000,
      workoutGoalUnits: 'kilograms',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Goblet Squat',
          repScheme: [5],
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const DecimalVolumeCalculation: Story = {
  parameters: {
    workoutOptions: {
      workoutGoal: 500,
      workoutGoalUnits: 'kilograms',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Goblet Squat',
          repScheme: [5],
          weightOneValue: 24.567,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const ComplexMode: Story = {
  parameters: {
    workoutOptions: {
      workoutMode: 'complex',
      sharedWeightOneValue: 24,
      sharedWeightOneUnit: 'kilograms',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Clean',
          repScheme: [5, 4, 3, 2, 1],
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Press',
          repScheme: [5, 4, 3, 2, 1],
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Front Squat',
          repScheme: [5, 4, 3, 2, 1],
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const ComplexModeDoubleBells: Story = {
  parameters: {
    workoutOptions: {
      workoutMode: 'complex',
      sharedWeightOneValue: 20,
      sharedWeightOneUnit: 'kilograms',
      sharedWeightTwoValue: 16,
      sharedWeightTwoUnit: 'kilograms',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Clean',
          repScheme: [5],
          weightOneValue: 20,
          weightOneUnit: 'kilograms',
          weightTwoValue: 16,
          weightTwoUnit: 'kilograms',
        },
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Press',
          repScheme: [5],
          weightOneValue: 20,
          weightOneUnit: 'kilograms',
          weightTwoValue: 16,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

export const ComplexModeDifferentRepSchemes: Story = {
  parameters: {
    workoutOptions: {
      workoutMode: 'complex',
      sharedWeightOneValue: 16,
      sharedWeightOneUnit: 'kilograms',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Swing',
          repScheme: [5, 4, 3],
          weightOneValue: 16,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Clean',
          repScheme: [3],
          weightOneValue: 16,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

// Mirrors a seeded Armor Building Complex session (Dan John) exactly — the first
// shipped program to use complexSet=true. One round = 2 cleans, 1 press, 3
// squats flowed together with double bells never set down; each movement's
// single-element repScheme means the longest is exhausted in ONE "Complete Set",
// so one press completes a whole round. restTimer models the ~30s rest BETWEEN
// rounds. Goal is 5 rounds (the W1D1 session).
const ARMOR_BUILDING_COMPLEX_MOVEMENTS = [
  {
    ...DEFAULT_MOVEMENT_OPTIONS,
    movementName: 'Double Kettlebell Clean',
    repScheme: [2],
    weightOneValue: 24,
    weightOneUnit: 'kilograms',
    weightTwoValue: 24,
    weightTwoUnit: 'kilograms',
  },
  {
    ...DEFAULT_MOVEMENT_OPTIONS,
    movementName: 'Double Kettlebell Military Press',
    repScheme: [1],
    weightOneValue: 24,
    weightOneUnit: 'kilograms',
    weightTwoValue: 24,
    weightTwoUnit: 'kilograms',
  },
  {
    ...DEFAULT_MOVEMENT_OPTIONS,
    movementName: 'Double Kettlebell Front Squat',
    repScheme: [3],
    weightOneValue: 24,
    weightOneUnit: 'kilograms',
    weightTwoValue: 24,
    weightTwoUnit: 'kilograms',
  },
] satisfies MovementOptions[];

export const ArmorBuildingComplex: Story = {
  parameters: {
    workoutOptions: {
      workoutMode: 'complex',
      restTimer: 30,
      workoutGoal: 5,
      workoutGoalUnits: 'rounds',
      sharedWeightOneValue: 24,
      sharedWeightOneUnit: 'kilograms',
      sharedWeightTwoValue: 24,
      sharedWeightTwoUnit: 'kilograms',
      movements: ARMOR_BUILDING_COMPLEX_MOVEMENTS,
    },
  },
};

// Same session with rest between rounds removed (a user-editable option), so a
// full 5-round session can be run to its rounds goal in one continuous flow.
export const ArmorBuildingComplexContinuous: Story = {
  parameters: {
    workoutOptions: {
      workoutMode: 'complex',
      restTimer: 0,
      workoutGoal: 5,
      workoutGoalUnits: 'rounds',
      sharedWeightOneValue: 24,
      sharedWeightOneUnit: 'kilograms',
      sharedWeightTwoValue: 24,
      sharedWeightTwoUnit: 'kilograms',
      movements: ARMOR_BUILDING_COMPLEX_MOVEMENTS,
    },
  },
};

// Straight sets (PROD-243) — the Easy Strength seed's shape: five patterns at
// 2x5, both sets of a movement before the next movement starts, with a fixed
// 1-round goal so one round is the whole prescription.
const EASY_STRENGTH_MOVEMENTS = [
  'Two-Arm Kettlebell Military Press',
  'Pull-Up',
  'Kettlebell Swing',
  'Double Kettlebell Front Squat',
  "Kettlebell Farmer's Carry",
].map((movementName) => ({
  ...DEFAULT_MOVEMENT_OPTIONS,
  movementName,
  repScheme: [5, 5],
  weightOneValue: 24,
  weightOneUnit: 'kilograms' as const,
  weightTwoValue: 24,
  weightTwoUnit: 'kilograms' as const,
})) satisfies MovementOptions[];

export const StraightSets: Story = {
  parameters: {
    workoutOptions: {
      workoutMode: 'straightSets',
      workoutGoal: 1,
      workoutGoalUnits: 'rounds',
      movements: EASY_STRENGTH_MOVEMENTS,
    },
  },
};

// The rotating order requires every movement to share a rung count; straight
// sets gives each movement its own ladder, so uneven prescriptions are legal.
export const StraightSetsUnevenLadders: Story = {
  parameters: {
    workoutOptions: {
      workoutMode: 'straightSets',
      workoutGoal: 1,
      workoutGoalUnits: 'rounds',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Two-Arm Kettlebell Military Press',
          repScheme: [5, 5, 5],
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: 24,
          weightTwoUnit: 'kilograms',
        },
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Kettlebell Swing',
          repScheme: [10, 10],
          weightOneValue: 24,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};

/**
 * A rung of 0 is "to failure": no prescription to show, so Continue opens the
 * reps dialog instead of assuming a number. Two 10 kg bells so the volume math
 * is unambiguous.
 */
export const MaxReps: Story = {
  parameters: {
    workoutOptions: {
      workoutGoal: 10,
      workoutGoalUnits: 'rounds',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Two-Arm Kettlebell Military Press',
          repScheme: [0, 0],
          weightOneValue: 10,
          weightOneUnit: 'kilograms',
          weightTwoValue: 10,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

/** A fixed prescription, so the Adjust reps button is what reports a short set. */
export const FixedRepsForAdjustment: Story = {
  parameters: {
    workoutOptions: {
      workoutGoal: 10,
      workoutGoalUnits: 'rounds',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Two-Arm Kettlebell Military Press',
          repScheme: [5, 5],
          weightOneValue: 10,
          weightOneUnit: 'kilograms',
          weightTwoValue: 10,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

/** A ladder that climbs to failure: 1, 2, then max. */
export const LadderToMaxReps: Story = {
  parameters: {
    workoutOptions: {
      workoutGoal: 10,
      workoutGoalUnits: 'rounds',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Two-Arm Kettlebell Military Press',
          repScheme: [1, 2, 0],
          weightOneValue: 10,
          weightOneUnit: 'kilograms',
          weightTwoValue: 10,
          weightTwoUnit: 'kilograms',
        },
      ] satisfies MovementOptions[],
    },
  },
};

/**
 * Hold to failure: a timed rung of 0 has no countdown to run, so the set clock
 * counts up and the Continue press is what records it — no dialog.
 */
export const MaxTimedRung: Story = {
  parameters: {
    workoutOptions: {
      workoutGoal: 10,
      workoutGoalUnits: 'rounds',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Kettlebell Front Rack Hold',
          repScheme: [0],
          timedRungs: true,
          weightOneValue: 16,
          weightOneUnit: 'kilograms',
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ] satisfies MovementOptions[],
    },
  },
};
