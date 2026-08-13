import type { Meta, StoryObj } from '@storybook/react';

import { Card } from '~/components/ui/card';

import { CustomMovementRow } from './CustomMovementRow';

const CATALOG = [
  { id: 'catalog-1', name: 'Kettlebell Clean and Press' },
  { id: 'catalog-2', name: 'Kettlebell Swing' },
  { id: 'catalog-3', name: 'Goblet Squat' },
  { id: 'catalog-4', name: 'Double Kettlebell Front Rack Squat' },
];

const meta: Meta<typeof CustomMovementRow> = {
  title: 'Movements/CustomMovementRow',
  component: CustomMovementRow,
  args: {
    catalog: CATALOG,
    isLinking: false,
    onLink: () => {},
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

export const WithSuggestion: Story = {
  args: {
    id: 'user-1',
    canonicalName: 'Clean and Press',
    logCount: 12,
  },
};

export const WithoutSuggestion: Story = {
  args: {
    id: 'user-2',
    canonicalName: 'Bottoms Up Carry',
    logCount: 1,
  },
};
