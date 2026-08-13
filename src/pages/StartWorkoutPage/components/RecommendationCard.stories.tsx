import type { Meta, StoryObj } from '@storybook/react';

import { Button } from '~/components/ui/button';
import { ExampleRecommendation } from '~/examples';

import { RecommendationCard } from './RecommendationCard';

const meta = {
  component: RecommendationCard,
  decorators: [
    (Story) => (
      <div className="max-w-sm p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RecommendationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { recommendation: new ExampleRecommendation() },
};

export const LowConfidence: Story = {
  args: { recommendation: new ExampleRecommendation({ confidence: 'low' }) },
};

export const WithActions: Story = {
  args: {
    recommendation: new ExampleRecommendation(),
    footer: <Button className="flex-1">Accept</Button>,
  },
};
