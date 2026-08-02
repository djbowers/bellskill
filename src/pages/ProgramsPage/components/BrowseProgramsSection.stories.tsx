import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { Program } from '~/types';

import { BrowseProgramsSection } from './BrowseProgramsSection';

const shared = (
  id: string,
  title: string,
  authorName: string,
  numWeeks: number | null,
  daysPerWeek: number | null,
  defaultAutoRepeat = false,
): Program => ({
  id,
  ownerId: null,
  sourceProgramId: null,
  slug: id,
  title,
  description: null,
  authorName,
  numWeeks,
  daysPerWeek,
  isPublic: true,
  createdAt: '',
  archivedAt: null,
  releasedAt: null,
  defaultAutoRepeat,
  stages: null,
});

const programs = [
  shared('ss', 'Simple & Sinister', 'Pavel Tsatsouline', null, null, true),
  shared('kb-mile', 'The Kettlebell Mile', 'Dr. Mike Prevost', 8, 1),
  shared('easy-strength', 'Easy Strength', 'Dan John', 2, 5),
  shared('abc', 'Armor Building Complex', 'Dan John', 5, 4),
  shared('dfw', 'Dry Fighting Weight', 'Geoff Neupert', 5, 3),
];

const meta = {
  component: BrowseProgramsSection,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="max-w-md p-2">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  args: {
    programs,
    showReleasedBadge: false,
    open: false,
    onOpenChange: () => {},
  },
} satisfies Meta<typeof BrowseProgramsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** How a returning user finds it: folded, below their own programs. */
export const Collapsed: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false);
    return <BrowseProgramsSection {...args} open={open} onOpenChange={setOpen} />;
  },
};

/** How a user with no programs of their own finds it. */
export const Expanded: Story = {
  render: (args) => {
    const [open, setOpen] = useState(true);
    return <BrowseProgramsSection {...args} open={open} onOpenChange={setOpen} />;
  },
};
