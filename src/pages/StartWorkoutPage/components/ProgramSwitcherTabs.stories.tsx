import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import type { ActiveProgram } from '~/api';
import { exampleActiveProgram } from '~/examples';

import { NextProgramWorkoutCard } from './NextProgramWorkoutCard';
import { ProgramSwitcherTabs } from './ProgramSwitcherTabs';

/**
 * The parallel-programs home surface: the switcher plus the card it drives.
 * They are shown together because the switcher only means anything in that
 * composition — picking a pill swaps which program the card below offers.
 */
const ProgramHomeSurface = ({ programs }: { programs: ActiveProgram[] }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const primary =
    programs.find((p) => p.enrollment.id === selectedId) ?? programs[0];

  return (
    <div className="flex max-w-sm flex-col gap-2 p-2">
      <ProgramSwitcherTabs
        programs={programs}
        selectedEnrollmentId={primary.enrollment.id}
        onSelect={setSelectedId}
      />
      <NextProgramWorkoutCard
        programTitle={primary.program.title}
        nextSession={primary.nextSession}
        progress={primary.progress}
        isComplete={primary.isComplete}
        onStart={() => {}}
        onSkip={() => {}}
        skipping={false}
        onViewProgress={() => {}}
      />
    </div>
  );
};

const meta = {
  component: ProgramHomeSurface,
} satisfies Meta<typeof ProgramHomeSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One program: the switcher renders nothing, so this surface is unchanged. */
export const SingleProgram: Story = {
  args: {
    programs: [exampleActiveProgram({ completed: 4 })],
  },
};

/** Two programs. Index 0 is least-recently-worked, so it is offered first. */
export const TwoPrograms: Story = {
  args: {
    programs: [
      exampleActiveProgram({
        id: 'up-1',
        title: 'Easy Strength',
        sessionTitle: '2x5 Press + Deadlift',
        total: 10,
        activeSlot: 1,
        workoutGoal: 1,
        workoutGoalUnits: 'rounds',
      }),
      exampleActiveProgram({
        id: 'up-2',
        completed: 4,
        activeSlot: 2,
        lastWorkedAt: '2026-07-22T00:00:00Z',
      }),
    ],
  },
};

/** At the cap. A fourth enroll raises PROGRAM_SLOTS_FULL until one is replaced. */
export const ThreeProgramsAtCap: Story = {
  args: {
    programs: [
      exampleActiveProgram({
        id: 'up-1',
        title: 'Easy Strength',
        sessionTitle: '2x5 Press + Deadlift',
        total: 10,
        activeSlot: 1,
        workoutGoal: 1,
        workoutGoalUnits: 'rounds',
      }),
      exampleActiveProgram({
        id: 'up-2',
        completed: 4,
        activeSlot: 2,
        lastWorkedAt: '2026-07-20T00:00:00Z',
      }),
      exampleActiveProgram({
        id: 'up-3',
        title: '10,000 Swing Challenge',
        sessionTitle: 'Swings + Presses',
        completed: 11,
        total: 20,
        activeSlot: 3,
        lastWorkedAt: '2026-07-22T00:00:00Z',
      }),
    ],
  },
};

/** The terminal state still renders when a finished program is selected. */
export const OneProgramComplete: Story = {
  args: {
    programs: [
      exampleActiveProgram({
        id: 'up-1',
        completed: 14,
        total: 14,
        lastWorkedAt: '2026-07-22T00:00:00Z',
      }),
    ],
  },
};
