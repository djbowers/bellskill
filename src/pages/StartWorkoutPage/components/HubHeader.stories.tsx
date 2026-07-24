import type { Meta, StoryObj } from '@storybook/react';

import { HubHeader } from './HubHeader';

// Fixed clock so the greeting and "days ago" copy are deterministic in stories.
const now = new Date('2026-07-24T09:00:00');

const meta = {
  component: HubHeader,
  args: { now },
  decorators: [
    (Story) => (
      <div className="max-w-md p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HubHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A returning user, a few days since their last session. */
export const Returning: Story = {
  args: { lastWorkoutAt: new Date('2026-07-21T18:00:00') },
};

/** Trained earlier today. */
export const Today: Story = {
  args: { lastWorkoutAt: new Date('2026-07-24T06:00:00') },
};

/** A brand-new user who hasn't trained yet. */
export const FirstTime: Story = {
  args: { lastWorkoutAt: null },
};
