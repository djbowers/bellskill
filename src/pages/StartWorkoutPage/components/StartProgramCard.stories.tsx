import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';

import { StartProgramCard } from './StartProgramCard';

const meta = {
  component: StartProgramCard,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="max-w-md p-2">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof StartProgramCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
