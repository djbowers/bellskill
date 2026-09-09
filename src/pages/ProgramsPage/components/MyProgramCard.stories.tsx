import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';

import { Program } from '~/types';
import { ProgramArc } from '~/utils';

import { MyProgramCard } from './MyProgramCard';

const program: Program = {
  id: 'p-1',
  ownerId: 'user-1',
  sourceProgramId: null,
  slug: null,
  title: 'Dry Fighting Weight',
  description: null,
  authorName: null,
  numWeeks: 5,
  daysPerWeek: 3,
  isPublic: false,
  createdAt: '',
  archivedAt: null,
  releasedAt: null,
  defaultAutoRepeat: false,
  stages: null,
  focusTags: ['strength', 'hypertrophy', 'conditioning'],
  systemicDemand: 'high',
};

const arc = (sessionsAhead: number): ProgramArc => ({
  sessionNumber: 8,
  totalSessions: 15,
  dayNumber: 12,
  totalDays: 35,
  projectedFinish: new Date(2026, 10, 11),
  sessionsAhead,
});

const meta = {
  component: MyProgramCard,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="flex max-w-md flex-col gap-2 p-2">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  args: {
    program,
    isActive: false,
    isQueued: false,
    isStarting: false,
    pending: {
      enroll: false,
      resume: false,
      cancel: false,
      archive: false,
      delete: false,
    },
    onStart: () => {},
    onAddSessions: () => {},
    onViewProgress: () => {},
    onQueueForLater: () => {},
    onRename: () => {},
    onCancel: () => {},
    onArchive: () => {},
    onDelete: () => {},
  },
} satisfies Meta<typeof MyProgramCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Has sessions, nothing running — the CTA is the start. */
export const Ready: Story = {};

/** Running now, on pace: the finish line replaces the cadence. */
export const Active: Story = { args: { isActive: true, arc: arc(0) } };

/** A lost week: the pace line is the one thing on the card that gets louder. */
export const ActiveBehind: Story = {
  args: { isActive: true, arc: arc(-2) },
};

/** Training faster than written. */
export const ActiveAhead: Story = {
  args: { isActive: true, arc: arc(3) },
};

/** A running repeating workout: position only, no finish line. */
export const ActiveRepeating: Story = {
  args: {
    isActive: true,
    program: { ...program, defaultAutoRepeat: true },
    arc: {
      ...arc(0),
      totalDays: null,
      projectedFinish: null,
      sessionsAhead: null,
    },
  },
};

/** Waiting on a slot: it starts from "Up next", so the card offers no start. */
export const Queued: Story = { args: { isQueued: true } };

/** No sessions yet, so no cadence and nothing to start — the CTA is the gap. */
export const Draft: Story = {
  args: { program: { ...program, numWeeks: null, daysPerWeek: null } },
};

/** A repeating workout has no finish line: the rail reads ∞. */
export const Repeating: Story = {
  args: { program: { ...program, defaultAutoRepeat: true } },
};

/**
 * The three tiers side by side, in the order the page sorts them — this is the
 * view to check when changing any state treatment.
 */
export const AllStates: Story = {
  render: (args) => (
    <>
      <MyProgramCard
        {...args}
        isActive
        arc={arc(-1)}
        program={{ ...program, title: 'Running Program' }}
      />
      <MyProgramCard
        {...args}
        isQueued
        program={{ ...program, title: 'Queued Program' }}
      />
      <MyProgramCard
        {...args}
        program={{ ...program, title: 'Ready Program' }}
      />
      <MyProgramCard
        {...args}
        program={{
          ...program,
          title: 'Draft Program',
          numWeeks: null,
          daysPerWeek: null,
        }}
      />
    </>
  ),
};
