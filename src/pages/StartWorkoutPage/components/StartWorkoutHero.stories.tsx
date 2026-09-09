import type { Meta, StoryObj } from '@storybook/react';

import { exampleActiveProgram } from '~/examples';
import { deriveProgramArc } from '~/utils';

import { StartWorkoutHero } from './StartWorkoutHero';

/**
 * The home page's single high-contrast surface. Shown on a narrow column to
 * mirror the mobile-first `Page` width it lives in. Stories use `render` because
 * the component's discriminated-union props don't survive Storybook's `args`
 * typing.
 */
// Untyped Meta/StoryObj: the component's discriminated-union props collapse
// Storybook's generic `Args` to `never`. Each story sets its props inside
// `render`, where they are still fully type-checked against the component.
const meta: Meta = {
  component: StartWorkoutHero,
  decorators: [
    (Story) => (
      <div className="max-w-md p-2">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj;

const midProgram = exampleActiveProgram({ completed: 7, total: 14 });
const doneProgram = exampleActiveProgram({ completed: 14, total: 14 });

// Fixed "today"s against the fixture's 2026-07-01 enrollment, so each story
// pins one pace state instead of drifting with the calendar.
const onTrackArc = deriveProgramArc(midProgram, new Date(2026, 6, 18));
const behindArc = deriveProgramArc(midProgram, new Date(2026, 7, 1));
const aheadArc = deriveProgramArc(midProgram, new Date(2026, 6, 10));

/** A running program's next session — the default hero, on pace. */
export const Program: Story = {
  render: () => (
    <StartWorkoutHero
      variant="program"
      programTitle={midProgram.program.title}
      nextSession={midProgram.nextSession}
      progress={midProgram.progress}
      arc={onTrackArc}
      isComplete={false}
      onStart={() => {}}
      onSkip={() => {}}
      skipping={false}
      onViewProgress={() => {}}
    />
  ),
};

/** A lost week: the finish date has slipped and the pace line says so. */
export const ProgramBehind: Story = {
  render: () => (
    <StartWorkoutHero
      variant="program"
      programTitle={midProgram.program.title}
      nextSession={midProgram.nextSession}
      progress={midProgram.progress}
      arc={behindArc}
      isComplete={false}
      onStart={() => {}}
      onSkip={() => {}}
      skipping={false}
      onViewProgress={() => {}}
    />
  ),
};

/** Training faster than written: the finish pulls in. */
export const ProgramAhead: Story = {
  render: () => (
    <StartWorkoutHero
      variant="program"
      programTitle={midProgram.program.title}
      nextSession={midProgram.nextSession}
      progress={midProgram.progress}
      arc={aheadArc}
      isComplete={false}
      onStart={() => {}}
      onSkip={() => {}}
      skipping={false}
      onViewProgress={() => {}}
    />
  ),
};

/** Skip in flight: the CTA is disabled and the footer reports the skip. */
export const ProgramSkipping: Story = {
  render: () => (
    <StartWorkoutHero
      variant="program"
      programTitle={midProgram.program.title}
      nextSession={midProgram.nextSession}
      progress={midProgram.progress}
      isComplete={false}
      onStart={() => {}}
      onSkip={() => {}}
      skipping
      onViewProgress={() => {}}
    />
  ),
};

/** Every session satisfied — the celebratory terminal state. */
export const ProgramComplete: Story = {
  render: () => (
    <StartWorkoutHero
      variant="program"
      programTitle={doneProgram.program.title}
      nextSession={null}
      progress={doneProgram.progress}
      isComplete
      onStart={() => {}}
      onSkip={() => {}}
      skipping={false}
      onViewProgress={() => {}}
    />
  ),
};

/** No active program: the quick-start anchor. */
export const QuickStart: Story = {
  render: () => (
    <StartWorkoutHero variant="quickStart" onBuildCustom={() => {}} />
  ),
};
