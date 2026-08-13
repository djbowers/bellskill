import type { Meta, StoryObj } from '@storybook/react';

import { WeightModeIndicator } from './WeightModeIndicator';

const meta: Meta<typeof WeightModeIndicator> = {
  title: 'MovementAutocomplete/WeightModeIndicator',
  component: WeightModeIndicator,
};
export default meta;

export const Bodyweight: StoryObj = { args: { mode: 'none' } };
export const TwoHand: StoryObj = { args: { mode: '2h' } };
export const Single: StoryObj = { args: { mode: '1h' } };
export const Double: StoryObj = { args: { mode: 'double' } };
