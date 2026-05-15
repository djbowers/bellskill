import { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from 'react-query';
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
