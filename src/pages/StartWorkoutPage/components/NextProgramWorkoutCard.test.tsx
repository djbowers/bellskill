import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { NextProgramSession, ProgramProgress } from '~/api';

import { NextProgramWorkoutCard } from './NextProgramWorkoutCard';

const nextSession: NextProgramSession = {
  session: {
    id: 'ps-8',
    programId: 'prog-1',
    sequenceIndex: 7, // 8th session
    weekNumber: 3,
    dayNumber: 2,
    title: 'Ladders 1-2-3-4',
    notes: null,
    workoutOptions: {
      complexSet: false,
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
    complexSet: false,
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

describe('NextProgramWorkoutCard', () => {
  it('renders the next session with week/day, session chip, duration and actions', () => {
    const onStart = vi.fn();
    const onSkip = vi.fn();

    render(
      <NextProgramWorkoutCard
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
    expect(screen.getByText('Week 3 · Day 2')).toBeInTheDocument();
    expect(screen.getByText('Ladders 1-2-3-4')).toBeInTheDocument();
    // sequenceIndex 7 → "Session 8 of 14".
    expect(screen.getByText('Session 8 of 14')).toBeInTheDocument();
    expect(screen.getByText('~30 min')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start next workout' }));
    expect(onStart).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('disables the actions while a skip is in flight', () => {
    render(
      <NextProgramWorkoutCard
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
    expect(screen.getByRole('button', { name: 'Skipping…' })).toBeDisabled();
  });

  it('renders the complete state when the program is finished', () => {
    render(
      <NextProgramWorkoutCard
        programTitle="Dry Fighting Weight"
        nextSession={null}
        progress={{ completed: 14, total: 14, week: 5, day: 3 }}
        isComplete
        onStart={vi.fn()}
        onSkip={vi.fn()}
        skipping={false}
      />,
    );

    expect(screen.getByText('🎉 Program complete')).toBeInTheDocument();
    expect(screen.getByText(/finished all 14 sessions/i)).toBeInTheDocument();
    // No start/skip actions in the complete state.
    expect(
      screen.queryByRole('button', { name: 'Start next workout' }),
    ).not.toBeInTheDocument();
  });
});
