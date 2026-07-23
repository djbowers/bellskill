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
    { ...DEFAULT_MOVEMENT_OPTIONS, movementName: 'Single Arm Clean & Press' },
  ],
  workoutDetails: 'Example Workout Details',
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

// Mirrors the seeded A+A Protocol "Plan A" session (Stage 4): single-KB one-arm
// clean & jerk, EMOM-paced at a 30s interval so consecutive auto-fires alternate
// hands (left on the minute, right 30s later). First shipped program to use
// intervalTimer.
export const AAProtocolPlanASession: Story = {
  parameters: {
    workoutOptions: {
      intervalTimer: 30,
      restTimer: 0,
      complexSet: false,
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

// Timed movements (PROD-200) — the Kettlebell Mile seed's shape: a single
// one-handed suitcase carry whose rungs are 2-minute carry segments. One-handed
// loading (weightTwoValue 0) makes the runtime mirror each rung per hand, which
// is exactly the source's "switch hands as often as you want."
export const KettlebellMileSession: Story = {
  parameters: {
    workoutOptions: {
      intervalTimer: 0,
      restTimer: 0,
      complexSet: false,
      workoutGoal: 1,
      workoutGoalUnits: 'rounds',
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Kettlebell Suitcase Carry',
          repScheme: [120, 120],
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
      complexSet: true,
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
      complexSet: true,
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
      complexSet: true,
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
    movementName: 'Two-Arm Kettlebell Clean',
    repScheme: [2],
    weightOneValue: 24,
    weightOneUnit: 'kilograms',
    weightTwoValue: 24,
    weightTwoUnit: 'kilograms',
  },
  {
    ...DEFAULT_MOVEMENT_OPTIONS,
    movementName: 'Two-Arm Kettlebell Military Press',
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
      complexSet: true,
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
      complexSet: true,
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
