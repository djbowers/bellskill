import type { Meta, StoryObj } from '@storybook/react';

import { exampleActiveProgram } from '~/examples';

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

/** A running program's next session — the default hero. */
export const Program: Story = {
  render: () => (
    <StartWorkoutHero
      variant="program"
      programTitle={midProgram.program.title}
      nextSession={midProgram.nextSession}
      progress={midProgram.progress}
      isComplete={false}
      onStart={() => {}}
      onSkip={() => {}}
      skipping={false}
      onViewProgress={() => {}}
    />
  ),
};

/** Skip in flight: both actions disabled. */
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

/** No active program: the quick-start anchor, with a one-tap repeat. */
export const QuickStart: Story = {
  render: () => (
    <StartWorkoutHero
      variant="quickStart"
      onBuildCustom={() => {}}
      onRepeatLast={() => {}}
    />
  ),
};

/** No active program and nothing to repeat (a brand-new user). */
export const QuickStartFirstTime: Story = {
  render: () => (
    <StartWorkoutHero variant="quickStart" onBuildCustom={() => {}} />
  ),
};
