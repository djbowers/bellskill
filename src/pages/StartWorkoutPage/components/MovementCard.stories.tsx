import { Meta, StoryObj } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { MovementOptions } from '~/types';

import { MovementCard, MovementCardProps } from './MovementCard';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const noop = () => {};

const swing: MovementOptions = {
  movementName: 'Double Clean',
  repScheme: [1, 2, 3],
  weightOneValue: 16,
  weightOneUnit: 'kilograms',
  weightTwoValue: 16,
  weightTwoUnit: 'kilograms',
};

const meta = {
  component: MovementCard,
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="max-w-md bg-background p-3">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    index: 0,
    movement: swing,
    sharedBell: false,
    sharedWeightTabValue: 'none',
    sharedWeights: {
      sharedWeightOneValue: null,
      sharedWeightOneUnit: null,
      sharedWeightTwoValue: null,
      sharedWeightTwoUnit: null,
    },
    intervalActive: false,
    onToggleExpanded: noop,
    onRemove: noop,
    onChangeName: noop,
    onChangeWeightTab: noop,
    onChangeWeightOneValue: noop,
    onChangeWeightOneUnit: noop,
    onChangeWeightTwoValue: noop,
    onChangeWeightTwoUnit: noop,
    onChangeRung: noop,
    onRemoveRung: noop,
    onAddRung: noop,
    onChangeRungMode: noop,
  },
} satisfies Meta<typeof MovementCard>;

export default meta;

type Story = StoryObj<typeof MovementCard>;

export const Expanded: Story = { args: { expanded: true } };

export const Collapsed: Story = { args: { expanded: false } };

/** In a complex set the card shows the shared 24 kg, not the movement's own 16 kg. */
const complexArgs = {
  sharedBell: true,
  sharedWeightTabValue: '2h',
  sharedWeights: {
    sharedWeightOneValue: 24,
    sharedWeightOneUnit: 'kilograms',
    sharedWeightTwoValue: null,
    sharedWeightTwoUnit: null,
  },
} satisfies Partial<MovementCardProps>;

export const ComplexSet: Story = { args: { ...complexArgs, expanded: true } };

export const ComplexSetCollapsed: Story = {
  args: { ...complexArgs, expanded: false },
};

/** The two states side by side, driven by the real collapse toggle. */
export const Interactive: Story = {
  render: (args) => {
    const [collapsed, setCollapsed] = useState<Set<number>>(new Set([1]));
    const movements = [swing, { ...swing, movementName: 'Double Press' }];
    return (
      <div className="flex flex-col gap-1.5">
        {movements.map((movement, index) => (
          <MovementCard
            {...args}
            key={index}
            index={index}
            movement={movement}
            expanded={!collapsed.has(index)}
            onToggleExpanded={() =>
              setCollapsed((prev) => {
                const next = new Set(prev);
                if (next.has(index)) next.delete(index);
                else next.add(index);
                return next;
              })
            }
          />
        ))}
      </div>
    );
  },
};
