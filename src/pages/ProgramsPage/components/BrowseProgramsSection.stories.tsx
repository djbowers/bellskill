import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { Program, ProgramFocusTag } from '~/types';

import { BrowseProgramsSection } from './BrowseProgramsSection';

const shared = (
  id: string,
  title: string,
  authorName: string,
  numWeeks: number | null,
  daysPerWeek: number | null,
  focusTags: ProgramFocusTag[],
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
  focusTags,
  systemicDemand: null,
});

const programs = [
  shared('ss', 'Simple & Sinister', 'Pavel Tsatsouline', null, null,
    ['power', 'strength', 'mobility'], true),
  shared('kb-mile', 'The Kettlebell Mile', 'Dr. Mike Prevost', 8, 1,
    ['endurance', 'conditioning']),
  shared('easy-strength', 'Easy Strength', 'Dan John', 2, 5,
    ['strength', 'skill']),
  shared('abc', 'Armor Building Complex', 'Dan John', 5, 4,
    ['hypertrophy', 'strength', 'conditioning']),
  shared('dfw', 'Dry Fighting Weight', 'Geoff Neupert', 5, 3,
    ['strength', 'hypertrophy', 'conditioning']),
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
