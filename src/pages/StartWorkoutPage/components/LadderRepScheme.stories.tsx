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

/** Tap a rung to focus it, then set its reps on the caliper picker. */
export const Ladder: Story = {
  render: () => {
    const [repScheme, setRepScheme] = useState<number[]>([1, 2, 3, 4, 5]);
    return (
      <LadderRepScheme
        repScheme={repScheme}
        onChangeRung={(rungIndex, value) =>
          setRepScheme((prev) =>
            prev.map((rung, i) => (i === rungIndex ? Math.max(1, value) : rung)),
          )
        }
        onClickMinusRung={() => setRepScheme((prev) => prev.slice(0, -1))}
        onClickPlusRung={() =>
          setRepScheme((prev) => [...prev, prev[prev.length - 1] ?? 1])
        }
        onToggleTimed={() => {}}
      />
    );
  },
};

export const SingleRung: Story = {
  render: () => {
    const [repScheme, setRepScheme] = useState<number[]>([5]);
    return (
      <LadderRepScheme
        repScheme={repScheme}
        onChangeRung={(rungIndex, value) =>
          setRepScheme((prev) =>
            prev.map((rung, i) => (i === rungIndex ? Math.max(1, value) : rung)),
          )
        }
        onClickMinusRung={() => setRepScheme((prev) => prev.slice(0, -1))}
        onClickPlusRung={() =>
          setRepScheme((prev) => [...prev, prev[prev.length - 1] ?? 1])
        }
        onToggleTimed={() => {}}
      />
    );
  },
};
