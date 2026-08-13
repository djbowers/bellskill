import { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { AddToWorkoutSection } from './AddToWorkoutSection';

const meta = {
  component: AddToWorkoutSection,
  decorators: [
    (Story) => (
      <div className="max-w-md bg-card p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AddToWorkoutSection>;

export default meta;

type Story = StoryObj<typeof AddToWorkoutSection>;

export const AllOff: Story = {
  args: {
    hasNotes: false,
    hasInterval: false,
    hasRest: false,
    hasSharedBell: false,
    onToggleInterval: () => {},
    onToggleNotes: () => {},
    onToggleRest: () => {},
    onToggleSharedBell: () => {},
  },
};

export const AllOn: Story = {
  args: {
    ...AllOff.args,
    hasNotes: true,
    hasInterval: true,
    hasRest: true,
    hasSharedBell: true,
  },
};

export const IntervalBlockedByTimedMovements: Story = {
  args: {
    ...AllOff.args,
    hasTimedMovements: true,
  },
};

export const SharedBellLockedByComplex: Story = {
  args: {
    ...AllOff.args,
    hasSharedBell: true,
    sharedBellLocked: true,
  },
};

const InteractiveTemplate = () => {
  const [hasNotes, setHasNotes] = useState(false);
  const [hasInterval, setHasInterval] = useState(false);
  const [hasRest, setHasRest] = useState(false);
  const [hasSharedBell, setHasSharedBell] = useState(false);

  return (
    <AddToWorkoutSection
      hasNotes={hasNotes}
      hasInterval={hasInterval}
      hasRest={hasRest}
      hasSharedBell={hasSharedBell}
      onToggleNotes={() => setHasNotes((prev) => !prev)}
      onToggleInterval={() => setHasInterval((prev) => !prev)}
      onToggleRest={() => setHasRest((prev) => !prev)}
      onToggleSharedBell={() => setHasSharedBell((prev) => !prev)}
    />
  );
};

export const Interactive: Story = {
  render: () => <InteractiveTemplate />,
};
