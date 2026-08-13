import { Meta, StoryObj } from '@storybook/react';

import { WorkoutProgress } from './WorkoutProgress';

const meta = {
  component: WorkoutProgress,
  args: {
    completedRounds: 0,
    completedVolume: 0,
    formattedTimeRemaining: '10:00',
    handleClickPause: () => {},
    onClickCancel: () => {},
    remainingMilliseconds: 600000,
    workoutGoal: 1000,
    workoutGoalUnits: 'kilograms',
    workoutTimerPaused: false,
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WorkoutProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

// Volume goal stories
export const VolumeGoalNoProgress: Story = {
  args: {
    completedVolume: 0,
    workoutGoal: 1000,
    workoutGoalUnits: 'kilograms',
  },
};

export const VolumeGoal25PercentComplete: Story = {
  args: {
    completedVolume: 250,
    workoutGoal: 1000,
    workoutGoalUnits: 'kilograms',
  },
};

export const VolumeGoal50PercentComplete: Story = {
  args: {
    completedVolume: 500,
    workoutGoal: 1000,
    workoutGoalUnits: 'kilograms',
  },
};

export const VolumeGoal75PercentComplete: Story = {
  args: {
    completedVolume: 750,
    workoutGoal: 1000,
    workoutGoalUnits: 'kilograms',
  },
};

export const VolumeGoal100PercentComplete: Story = {
  args: {
    completedVolume: 1000,
    workoutGoal: 1000,
    workoutGoalUnits: 'kilograms',
  },
};

export const VolumeGoalExceeded: Story = {
  args: {
    completedVolume: 1200,
    workoutGoal: 1000,
    workoutGoalUnits: 'kilograms',
  },
};

export const VolumeGoalSignificantlyExceeded: Story = {
  args: {
    completedVolume: 2500,
    workoutGoal: 1000,
    workoutGoalUnits: 'kilograms',
  },
};

export const VolumeGoalLargeValues: Story = {
  args: {
    completedVolume: 1200,
    workoutGoal: 10000,
    workoutGoalUnits: 'kilograms',
  },
};

export const VolumeGoalLargeValuesHalfway: Story = {
  args: {
    completedVolume: 7500,
    workoutGoal: 10000,
    workoutGoalUnits: 'kilograms',
  },
};

export const VolumeGoalVeryLargeValues: Story = {
  args: {
    completedVolume: 50000,
    workoutGoal: 100000,
    workoutGoalUnits: 'kilograms',
  },
};

export const VolumeGoalZero: Story = {
  args: {
    completedVolume: 100,
    workoutGoal: 0,
    workoutGoalUnits: 'kilograms',
  },
};

// Time goal stories
export const TimeGoal: Story = {
  args: {
    workoutGoalUnits: 'minutes',
    workoutGoal: 10,
    formattedTimeRemaining: '10:00',
    remainingMilliseconds: 600000,
  },
};

// Rounds goal stories
export const RoundsGoal: Story = {
  args: {
    workoutGoalUnits: 'rounds',
    workoutGoal: 5,
    completedRounds: 2,
  },
};

// Circuit and straight sets count in sets, so the bar moves on every movement
// instead of sitting flat through a whole lap.
export const SetsRemaining: Story = {
  args: {
    workoutGoalUnits: 'rounds',
    workoutGoal: 5,
    completedRounds: 2,
    completedSets: 7,
    totalSets: 15,
  },
};
