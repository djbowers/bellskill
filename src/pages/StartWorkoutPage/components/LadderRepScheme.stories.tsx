import { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { LadderRepScheme } from './LadderRepScheme';

const meta = {
  component: LadderRepScheme,
  decorators: [
    (Story) => (
      <div className="max-w-md bg-background p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LadderRepScheme>;

export default meta;

type Story = StoryObj<typeof LadderRepScheme>;

const StatefulLadder = ({
  initial,
  timedRungs = false,
  maxReps = false,
}: {
  initial: number[];
  timedRungs?: boolean;
  maxReps?: boolean;
}) => {
  const [repScheme, setRepScheme] = useState<number[]>(initial);
  return (
    <LadderRepScheme
      repScheme={repScheme}
      timedRungs={timedRungs}
      maxReps={maxReps}
      onChangeRung={(rungIndex, value) =>
        setRepScheme((prev) =>
          prev.map((rung, i) => (i === rungIndex ? Math.max(1, value) : rung)),
        )
      }
      onRemoveRung={(rungIndex) =>
        setRepScheme((prev) => prev.filter((_, i) => i !== rungIndex))
      }
      onAddRung={() =>
        setRepScheme((prev) => [...prev, prev[prev.length - 1] ?? 1])
      }
      onChangeRungMode={() => {}}
    />
  );
};

/** Tap a rung to focus it, then set its reps on the caliper picker. */
export const Ladder: Story = {
  render: () => <StatefulLadder initial={[1, 2, 3, 4, 5]} />,
};

/** The last rung can't be removed, so it carries no ×. */
export const SingleRung: Story = {
  render: () => <StatefulLadder initial={[5]} />,
};

/** Timed rungs render the widest labels — the tightest fit for the corner ×. */
export const TimedRungs: Story = {
  render: () => <StatefulLadder initial={[60, 45, 30]} timedRungs />,
};

/** At ten rungs the add slot drops away. */
export const MaxRungs: Story = {
  render: () => <StatefulLadder initial={[1, 2, 3, 4, 5, 5, 4, 3, 2, 1]} />,
};

/** Max reps has no magnitude: the rungs become bare set slots. */
export const MaxReps: Story = {
  render: () => <StatefulLadder initial={[5, 5, 5]} maxReps />,
};
