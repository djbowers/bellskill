import { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { WorkoutMode } from '~/types';

import { WorkoutModeTabs } from './WorkoutModeTabs';

const meta = {
  component: WorkoutModeTabs,
  decorators: [
    (Story) => (
      <div className="max-w-md bg-card p-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WorkoutModeTabs>;

export default meta;

type Story = StoryObj<typeof WorkoutModeTabs>;

export const Circuit: Story = {
  args: { value: 'circuit', onValueChange: () => {} },
};

export const StraightSets: Story = {
  args: { value: 'straightSets', onValueChange: () => {} },
};

export const Complex: Story = {
  args: { value: 'complex', onValueChange: () => {} },
};

const InteractiveTemplate = () => {
  const [value, setValue] = useState<WorkoutMode>('circuit');
  return <WorkoutModeTabs value={value} onValueChange={setValue} />;
};

export const Interactive: Story = {
  render: () => <InteractiveTemplate />,
};
