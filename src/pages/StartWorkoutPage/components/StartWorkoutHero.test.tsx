import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { NextProgramSession, ProgramProgress } from '~/api';

import { StartWorkoutHero } from './StartWorkoutHero';

const nextSession: NextProgramSession = {
  session: {
    id: 'ps-8',
    programId: 'prog-1',
    sequenceIndex: 7, // 8th session
    weekNumber: 3,
    dayNumber: 2,
    title: 'Ladders 1-2-3-4',
    notes: null,
    weightLabel: null,
    workoutOptions: {
      workoutMode: 'circuit',
      intervalTimer: 0,
      movements: [],
      restTimer: 0,
      sharedWeightOneUnit: null,
      sharedWeightOneValue: null,
      sharedWeightTwoUnit: null,
      sharedWeightTwoValue: null,
      title: null,
      preWorkoutNotes: null,
      workoutGoal: 30,
      workoutGoalUnits: 'minutes',
    },
  },
  workoutOptions: {
    workoutMode: 'circuit',
    intervalTimer: 0,
    movements: [],
    restTimer: 0,
    sharedWeightOneUnit: null,
    sharedWeightOneValue: null,
    sharedWeightTwoUnit: null,
    sharedWeightTwoValue: null,
    title: null,
    preWorkoutNotes: null,
    workoutGoal: 30,
    workoutGoalUnits: 'minutes',
  },
};

const progress: ProgramProgress = {
  completed: 7,
  total: 14,
  week: 3,
  day: 2,
};

// Skip sits behind the hero's ⋯ menu and a confirm, and OverflowMenu defers the
// selection a tick so the menu can close before the dialog mounts.
const openSkipConfirm = async (programTitle: string) => {
  fireEvent.keyDown(
    screen.getByRole('button', { name: `More actions for ${programTitle}` }),
    { key: 'Enter' },
  );
  fireEvent.click(screen.getByRole('menuitem', { name: 'Skip this session' }));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('StartWorkoutHero', () => {
  describe('program variant', () => {
    it('renders the next session with title, chip, week/day, duration, progress and actions', async () => {
      const onStart = vi.fn();
      const onSkip = vi.fn();

      render(
        <StartWorkoutHero
          variant="program"
          programTitle="Dry Fighting Weight"
          nextSession={nextSession}
          progress={progress}
          isComplete={false}
          onStart={onStart}
          onSkip={onSkip}
          skipping={false}
        />,
      );

      expect(screen.getByText('Dry Fighting Weight')).toBeInTheDocument();
      expect(screen.getByText('Ladders 1-2-3-4')).toBeInTheDocument();
      // sequenceIndex 7 → "Session 8 of 14".
      expect(screen.getByText('Session 8 of 14')).toBeInTheDocument();
      expect(screen.getByText(/Week 3 . Day 2/)).toBeInTheDocument();
      expect(screen.getByText(/~30 min/)).toBeInTheDocument();
      // 7 of 14 satisfied → 50%.
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        '50',
      );

      fireEvent.click(
        screen.getByRole('button', { name: 'Start next workout' }),
      );
      expect(onStart).toHaveBeenCalledTimes(1);

      await openSkipConfirm('Dry Fighting Weight');
      expect(onSkip).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Skip session' }));
      expect(onSkip).toHaveBeenCalledTimes(1);
    });

    it('leaves the session alone when the skip confirm is dismissed', async () => {
      const onSkip = vi.fn();

      render(
        <StartWorkoutHero
          variant="program"
          programTitle="Dry Fighting Weight"
          nextSession={nextSession}
          progress={progress}
          isComplete={false}
          onStart={vi.fn()}
          onSkip={onSkip}
          skipping={false}
        />,
      );

      await openSkipConfirm('Dry Fighting Weight');
      fireEvent.click(screen.getByRole('button', { name: 'Keep this session' }));

      expect(onSkip).not.toHaveBeenCalled();
      expect(
        screen.queryByRole('button', { name: 'Skip session' }),
      ).not.toBeInTheDocument();
    });

    it('falls back to week/day as the title when the session has none', () => {
      render(
        <StartWorkoutHero
          variant="program"
          programTitle="Dry Fighting Weight"
          nextSession={{
            ...nextSession,
            session: { ...nextSession.session, title: '' },
          }}
          progress={progress}
          isComplete={false}
          onStart={vi.fn()}
          onSkip={vi.fn()}
          skipping={false}
        />,
      );

      expect(screen.getByText('Week 3 · Day 2')).toBeInTheDocument();
    });

    it('disables the actions while a skip is in flight', () => {
      render(
        <StartWorkoutHero
          variant="program"
          programTitle="Dry Fighting Weight"
          nextSession={nextSession}
          progress={progress}
          isComplete={false}
          onStart={vi.fn()}
          onSkip={vi.fn()}
          skipping
        />,
      );

      expect(
        screen.getByRole('button', { name: 'Start next workout' }),
      ).toBeDisabled();
      expect(screen.getByText('Skipping this session…')).toBeInTheDocument();

      fireEvent.keyDown(
        screen.getByRole('button', {
          name: 'More actions for Dry Fighting Weight',
        }),
        { key: 'Enter' },
      );
      expect(
        screen.getByRole('menuitem', { name: 'Skip this session' }),
      ).toHaveAttribute('aria-disabled', 'true');
    });

    it('renders the complete state when the program is finished', () => {
      render(
        <StartWorkoutHero
          variant="program"
          programTitle="Dry Fighting Weight"
          nextSession={null}
          progress={{ completed: 14, total: 14, week: 5, day: 3 }}
          isComplete
          onStart={vi.fn()}
          onSkip={vi.fn()}
          skipping={false}
          onViewProgress={vi.fn()}
        />,
      );

      expect(screen.getByText('🎉 Program complete')).toBeInTheDocument();
      expect(screen.getByText(/finished all 14 sessions/i)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Start next workout' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('quick-start variant', () => {
    it('builds a custom workout and repeats the last one', () => {
      const onBuildCustom = vi.fn();
      const onRepeatLast = vi.fn();

      render(
        <StartWorkoutHero
          variant="quickStart"
          onBuildCustom={onBuildCustom}
          onRepeatLast={onRepeatLast}
        />,
      );

      expect(screen.getByText('Start a workout')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Build a workout' }));
      expect(onBuildCustom).toHaveBeenCalledTimes(1);

      fireEvent.click(
        screen.getByRole('button', { name: /repeat last workout/i }),
      );
      expect(onRepeatLast).toHaveBeenCalledTimes(1);
    });

    it('omits the repeat action when there is nothing to repeat', () => {
      render(
        <StartWorkoutHero variant="quickStart" onBuildCustom={vi.fn()} />,
      );

      expect(
        screen.queryByRole('button', { name: /repeat last workout/i }),
      ).not.toBeInTheDocument();
    });
  });
});
