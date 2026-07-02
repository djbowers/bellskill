import { Meta, StoryObj } from '@storybook/react';

import { WorkoutSummary } from './WorkoutSummary';

const meta = {
  component: WorkoutSummary,
  args: {
    completedReps: 15,
    completedRounds: 3,
    completedVolume: 600,
    logWorkoutLoading: false,
    onClickFinish: () => {},
    startedAt: new Date(),
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

export const HighVolume: Story = {
  args: {
    completedReps: 120,
    completedRounds: 12,
    completedVolume: 4860,
  },
};
