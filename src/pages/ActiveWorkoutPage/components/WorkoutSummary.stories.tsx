import { Meta, StoryObj } from '@storybook/react';

import { WorkoutSummary } from './WorkoutSummary';

const meta = {
  component: WorkoutSummary,
  args: {
    completedReps: 15,
    completedRounds: 3,
    completedRungs: 3,
    completedSides: 6,
    completedVolume: 600,
    logWorkoutLoading: false,
    onClickFinish: () => {},
    startedAt: new Date(),
    workoutGoal: 30,
    workoutGoalUnits: 'minutes',
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WorkoutSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Rounds: Story = {
  args: {
    workoutGoal: 10,
    workoutGoalUnits: 'rounds',
  },
};
