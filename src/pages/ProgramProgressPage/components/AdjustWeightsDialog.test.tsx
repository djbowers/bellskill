import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { ProgramSession } from '~/types';

import { SessionWithState } from '~/pages/ProgramDetailsPage/utils/selectWeightModalSessions';

import { AdjustWeightsDialog } from './AdjustWeightsDialog';

const { mockAdjustMutate, mockShowToast } = vi.hoisted(() => ({
  mockAdjustMutate: vi.fn(),
  mockShowToast: vi.fn(),
}));

vi.mock('~/api', () => ({
  useAdjustProgramWeights: () => ({
    mutate: mockAdjustMutate,
    isPending: false,
  }),
}));

vi.mock('~/contexts', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const bareOptions = {
  workoutMode: 'circuit' as const,
  sharedBell: false,
  intervalTimer: 0,
  restTimer: 0,
  sharedWeightOneUnit: null,
  sharedWeightOneValue: null,
  sharedWeightTwoUnit: null,
  sharedWeightTwoValue: null,
  title: null,
  preWorkoutNotes: null,
  workoutGoal: 30,
  workoutGoalUnits: 'minutes' as const,
};

const session = (
  id: string,
  overrides: Partial<ProgramSession['workoutOptions']>,
): ProgramSession => ({
  id,
  programId: 'prog-1',
  sequenceIndex: 0,
  weekNumber: 1,
  dayNumber: 1,
  title: 'Session',
  notes: null,
  weightLabel: null,
  workoutOptions: { ...bareOptions, movements: [], ...overrides },
});

const upcoming = (sessions: ProgramSession[]): SessionWithState[] =>
  sessions.map((session) => ({ session, state: 'upcoming' as const }));

const perMovementSessions: ProgramSession[] = [
  session('ps-1', {
    movements: [
      {
        movementName: 'Kettlebell Swing',
        repScheme: [10],
        weightOneValue: 24,
        weightOneUnit: 'kilograms',
        weightTwoValue: null,
        weightTwoUnit: null,
      },
      {
        movementName: 'Pull-Up',
        repScheme: [5],
        weightOneValue: null,
        weightOneUnit: null,
        weightTwoValue: null,
        weightTwoUnit: null,
      },
    ],
  }),
];

const complexSessions: ProgramSession[] = [
  session('ps-1', {
    workoutMode: 'complex',
    sharedBell: false,
    sharedWeightOneValue: 20,
    sharedWeightOneUnit: 'kilograms',
    sharedWeightTwoValue: null,
    sharedWeightTwoUnit: null,
    movements: [
      {
        movementName: 'Clean',
        repScheme: [5],
        weightOneValue: null,
        weightOneUnit: null,
        weightTwoValue: null,
        weightTwoUnit: null,
      },
    ],
  }),
];

describe('AdjustWeightsDialog', () => {
  beforeEach(() => {
    mockAdjustMutate.mockReset();
    mockShowToast.mockReset();
  });

  it('renders one editable control per movement and labels the bodyweight one', () => {
    render(
      <AdjustWeightsDialog
        open
        onOpenChange={vi.fn()}
        userProgramId="up-1"
        sessionItems={upcoming(perMovementSessions)}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Adjust weights' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Kettlebell Swing')).toBeInTheDocument();
    expect(screen.getByText('Pull-Up')).toBeInTheDocument();
    expect(screen.getByText('Bodyweight')).toBeInTheDocument();
  });

  it('submits the adjusted per-movement weight and closes on success', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    mockAdjustMutate.mockImplementation((_args, { onSuccess }) =>
      onSuccess(2),
    );

    render(
      <AdjustWeightsDialog
        open
        onOpenChange={onOpenChange}
        userProgramId="up-1"
        sessionItems={upcoming(perMovementSessions)}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: '+ kg — Kettlebell Swing',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Update weights' }));

    expect(mockAdjustMutate).toHaveBeenCalledWith(
      {
        userProgramId: 'up-1',
        movementWeights: [
          expect.objectContaining({
            movementName: 'Kettlebell Swing',
            weightOneValue: 25,
            weightOneUnit: 'kilograms',
          }),
        ],
      },
      expect.anything(),
    );
    expect(mockShowToast).toHaveBeenCalledWith(
      'Weights updated for 2 upcoming sessions',
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('submits a single shared weight for a complex-set program', async () => {
    const user = userEvent.setup();
    mockAdjustMutate.mockImplementation((_args, { onSuccess }) =>
      onSuccess(1),
    );

    render(
      <AdjustWeightsDialog
        open
        onOpenChange={vi.fn()}
        userProgramId="up-1"
        sessionItems={upcoming(complexSessions)}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Update weights' }));

    expect(mockAdjustMutate).toHaveBeenCalledWith(
      {
        userProgramId: 'up-1',
        sharedWeightOneValue: 20,
        sharedWeightOneUnit: 'kilograms',
        sharedWeightTwoValue: null,
        sharedWeightTwoUnit: null,
      },
      expect.anything(),
    );
    expect(mockShowToast).toHaveBeenCalledWith(
      'Weights updated for 1 upcoming session',
    );
  });

  it('closes without submitting when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <AdjustWeightsDialog
        open
        onOpenChange={onOpenChange}
        userProgramId="up-1"
        sessionItems={upcoming(perMovementSessions)}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockAdjustMutate).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders nothing when closed', () => {
    render(
      <AdjustWeightsDialog
        open={false}
        onOpenChange={vi.fn()}
        userProgramId="up-1"
        sessionItems={upcoming(perMovementSessions)}
      />,
    );

    expect(
      screen.queryByRole('heading', { name: 'Adjust weights' }),
    ).not.toBeInTheDocument();
  });
});
