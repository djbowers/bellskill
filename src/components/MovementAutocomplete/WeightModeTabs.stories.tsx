import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { WeightTabValue } from '~/types';

import { WeightModeTabs } from './WeightModeTabs';

const meta: Meta<typeof WeightModeTabs> = {
  title: 'MovementAutocomplete/WeightModeTabs',
  component: WeightModeTabs,
};
export default meta;

const Interactive = ({
  initial,
  widthClassName = 'max-w-md',
}: {
  initial: WeightTabValue;
  widthClassName?: string;
}) => {
  const [value, setValue] = useState<WeightTabValue>(initial);
  return (
    <div className={widthClassName}>
      <WeightModeTabs value={value} onValueChange={setValue} />
    </div>
  );
};

export const Bodyweight: StoryObj = { render: () => <Interactive initial="none" /> };
export const TwoHand: StoryObj = { render: () => <Interactive initial="2h" /> };
export const Single: StoryObj = { render: () => <Interactive initial="1h" /> };
export const Double: StoryObj = { render: () => <Interactive initial="double" /> };

/** Approximates the MovementCard content width on a 320px-wide phone. */
export const NarrowPhone: StoryObj = {
  render: () => <Interactive initial="2h" widthClassName="w-[300px]" />,
};

/** Read-only: the catalog already settled how this movement is held. */
export const Locked: StoryObj = {
  render: () => (
    <div className="max-w-md">
      <WeightModeTabs value="1h" onValueChange={() => {}} disabled />
    </div>
  ),
};
