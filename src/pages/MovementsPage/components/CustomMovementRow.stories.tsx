import type { Meta, StoryObj } from '@storybook/react';

import { Card } from '~/components/ui/card';

import { CustomMovementRow } from './CustomMovementRow';

const meta: Meta<typeof CustomMovementRow> = {
  title: 'Movements/CustomMovementRow',
  component: CustomMovementRow,
  args: {
    onClickLink: () => {},
    onViewLogs: () => {},
    onDelete: () => {},
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Card>
          <div className="divide-y">
            <Story />
          </div>
        </Card>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CustomMovementRow>;

export const Default: Story = {
  args: {
    canonicalName: 'Clean and Press',
    logCount: 12,
  },
};

export const SingleLog: Story = {
  args: {
    canonicalName: 'My Homemade Sandbag Carry',
    logCount: 1,
  },
};

export const NoLogs: Story = {
  args: {
    canonicalName: 'Kettlebel Swng',
    logCount: 0,
  },
};

export const LongName: Story = {
  args: {
    canonicalName: 'Double Kettlebell Front Rack Reverse Lunge to Press',
    logCount: 3,
  },
};
