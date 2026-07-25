import type { Meta, StoryObj } from '@storybook/react';

import { BuildCustomCard } from './BuildCustomCard';

const meta = {
  component: BuildCustomCard,
  decorators: [
    (Story) => (
      <div className="max-w-md p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BuildCustomCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onClick: () => {} },
};
