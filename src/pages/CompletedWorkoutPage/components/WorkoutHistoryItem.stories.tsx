import { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from 'react-query';

import { SessionProvider } from '~/contexts';

import {
  WorkoutHistoryItem,
  WorkoutHistoryItemProps,
} from './WorkoutHistoryItem';

const mockSession = {
  user: {
    id: 'user-123',
    app_metadata: {},
    user_metadata: {},
    created_at: '',
    aud: '',
  },
  access_token: '',
  refresh_token: '',
  expires_in: 10000,
  token_type: '',
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const meta = {
  component: WorkoutHistoryItem,
  args: {
    workoutLogId: 1,
    completedAt: new Date('2024-01-01T13:15:00'),
    completedReps: 50,
    completedRungs: 10,
    completedRounds: 10,
    completedSides: 20,
    completedVolume: 1000,
    intervalTimer: 0,
    movementLogs: [
      {
        movementName: 'Single Arm Front Squat',
        id: 1,
        repScheme: [5],
        weightOneUnit: 'kilograms',
        weightOneValue: 16,
        userMovementId: null,
        functionalMovementId: null,
        weightTwoUnit: null,
        weightTwoValue: 0,
      },
      {
        movementName: 'Single Arm Overhead Press',
        id: 2,
        repScheme: [5],
        weightOneUnit: 'kilograms',
        weightOneValue: 16,
        userMovementId: null,
        functionalMovementId: null,
        weightTwoUnit: null,
        weightTwoValue: 0,
      },
    ],
    movementLogsLoading: false,
    restTimer: 0,
    startedAt: new Date('2024-01-01T12:00:00'),
    workoutDetails: 'The Giant 3.0 W1D2',
    workoutGoal: 10,
    workoutGoalUnits: 'minutes',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <SessionProvider value={mockSession}>
          <div className="max-w-sm">
            <Story />
          </div>
        </SessionProvider>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<WorkoutHistoryItemProps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DoubleBells: Story = {
  args: {
    movementLogs: [
      {
        movementName: 'Double Front Squat',
        id: 1,
        repScheme: [5],
        userMovementId: null,
        functionalMovementId: null,
        weightOneUnit: 'kilograms',
        weightOneValue: 24,
        weightTwoUnit: 'kilograms',
        weightTwoValue: 24,
      },
      {
        movementName: 'Double Overhead Press',
        id: 2,
        repScheme: [5],
        userMovementId: null,
        functionalMovementId: null,
        weightOneUnit: 'kilograms',
        weightOneValue: 24,
        weightTwoUnit: 'kilograms',
        weightTwoValue: 24,
      },
    ],
  },
};

export const MixedBells: Story = {
  args: {
    movementLogs: [
      {
        movementName: 'Double Front Squat',
        id: 1,
        repScheme: [5],
        userMovementId: null,
        functionalMovementId: null,
        weightOneUnit: 'kilograms',
        weightOneValue: 16,
        weightTwoUnit: 'kilograms',
        weightTwoValue: 24,
      },
      {
        movementName: 'Double Overhead Press',
        id: 2,
        repScheme: [5],
        userMovementId: null,
        functionalMovementId: null,
        weightOneUnit: 'kilograms',
        weightOneValue: 16,
        weightTwoUnit: 'kilograms',
        weightTwoValue: 24,
      },
    ],
  },
};

export const RoundsGoal: Story = {
  args: {
    workoutGoal: 15,
    workoutGoalUnits: 'rounds',
  },
};

export const Bodyweight: Story = {
  args: {
    movementLogs: [
      {
        movementName: 'Pull-Ups',
        id: 1,
        repScheme: [5],
        userMovementId: null,
        functionalMovementId: null,
        weightOneUnit: null,
        weightOneValue: null,
        weightTwoUnit: null,
        weightTwoValue: null,
      },
    ],
  },
};

export const WithTimers: Story = {
  args: {
    intervalTimer: 60,
    restTimer: 30,
  },
};

export const Loading: Story = {
  args: {
    movementLogsLoading: true,
  },
};

export const ComplexSet: Story = {
  args: {
    complexSet: true,
    sharedWeightOneUnit: 'kilograms',
    sharedWeightOneValue: 24,
    sharedWeightTwoUnit: null,
    sharedWeightTwoValue: null,
    movementLogs: [
      {
        movementName: 'Clean and Press',
        id: 1,
        repScheme: [3, 2, 1],
        userMovementId: null,
        functionalMovementId: null,
        weightOneUnit: 'kilograms',
        weightOneValue: 24,
        weightTwoUnit: null,
        weightTwoValue: null,
      },
      {
        movementName: 'Front Squat',
        id: 2,
        repScheme: [1, 2, 3],
        userMovementId: null,
        functionalMovementId: null,
        weightOneUnit: 'kilograms',
        weightOneValue: 24,
        weightTwoUnit: null,
        weightTwoValue: null,
      },
    ],
  },
};

export const CatalogLinkedLongName: Story = {
  args: {
    movementLogs: [
      {
        movementName: 'Double Kettlebell Push Press',
        id: 1,
        repScheme: [5],
        userMovementId: 'um-1',
        functionalMovementId: 'mov-1',
        weightOneUnit: 'kilograms',
        weightOneValue: 16,
        weightTwoUnit: 'kilograms',
        weightTwoValue: 16,
      },
    ],
  },
};
