import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { ProgramDetailsPage } from './ProgramDetailsPage';

const {
  mockUseProgram,
  mockUseActiveProgram,
  mockUseEnrollProgram,
  enrollMutate,
} = vi.hoisted(() => ({
  mockUseProgram: vi.fn(),
  mockUseActiveProgram: vi.fn(),
  mockUseEnrollProgram: vi.fn(),
  enrollMutate: vi.fn(),
}));

vi.mock('~/api', () => ({
  useProgram: mockUseProgram,
  useActiveProgram: mockUseActiveProgram,
  useEnrollProgram: mockUseEnrollProgram,
}));

vi.mock('~/contexts', async () => {
  const actual =
    await vi.importActual<typeof import('~/contexts')>('~/contexts');
  return {
    ...actual,
    useSession: () => ({ user: { id: 'user-123' } }),
  };
});

// A shared-program session whose first-movement weights drive the derived
// starting weight. `weightTwo` null → two-hand, 0 → single, >0 → double.
const sharedSession = (
  seq: number,
  week: number,
  day: number,
  title: string,
  weightOne: number,
  weightTwo: number | null,
) => ({
  id: `s-${seq}`,
  programId: 'dfw-1',
  sequenceIndex: seq,
  weekNumber: week,
  dayNumber: day,
  title,
  notes: null,
  workoutOptions: {
    complexSet: false,
    intervalTimer: 0,
    restTimer: 0,
    workoutDetails: null,
    workoutGoal: 20,
    workoutGoalUnits: 'minutes',
    sharedWeightOneValue: null,
    sharedWeightOneUnit: null,
    sharedWeightTwoValue: null,
    sharedWeightTwoUnit: null,
    movements: [
      {
        movementName: 'Double Kettlebell Press',
        repScheme: [5],
        weightOneValue: weightOne,
        weightOneUnit: 'kilograms',
        weightTwoValue: weightTwo,
        weightTwoUnit: weightTwo ? 'kilograms' : null,
      },
      {
        movementName: 'Kettlebell Swing',
        repScheme: [10],
        weightOneValue: weightOne,
        weightOneUnit: 'kilograms',
        weightTwoValue: weightTwo,
        weightTwoUnit: weightTwo ? 'kilograms' : null,
      },
    ],
  },
});

const dfw = {
  id: 'dfw-1',
  ownerId: null,
  sourceProgramId: null,
  slug: 'dry-fighting-weight',
  title: 'Dry Fighting Weight',
  description: 'Five weeks of double kettlebell strength work.',
  authorName: 'Geoff Neupert',
  numWeeks: 2,
  daysPerWeek: 1,
  isPublic: true,
  createdAt: '',
  archivedAt: null,
};

const dfwSessions = [
  sharedSession(0, 1, 1, 'Press Ladders', 24, 24),
  sharedSession(1, 2, 1, 'Clean & Press', 24, 24),
];

const renderPage = (id = 'dfw-1') =>
  render(
    <MemoryRouter initialEntries={[`/programs/${id}/details`]}>
      <Routes>
        <Route path="/programs/:id/details" element={<ProgramDetailsPage />} />
        <Route path="/programs/:id" element={<div>progress page</div>} />
        <Route path="/programs" element={<div>programs list</div>} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ProgramDetailsPage', () => {
  beforeEach(() => {
    enrollMutate.mockReset();
    mockUseActiveProgram.mockReturnValue({ data: null });
    mockUseEnrollProgram.mockReturnValue({
      mutate: enrollMutate,
      isLoading: false,
    });
    mockUseProgram.mockReturnValue({
      data: { program: dfw, sessions: dfwSessions },
      isLoading: false,
      isError: false,
    });
  });

  it('renders the program header, description, and week-by-week sessions', () => {
    renderPage();

    expect(screen.getByText('Dry Fighting Weight')).toBeInTheDocument();
    expect(
      screen.getByText('Geoff Neupert · 2 weeks · 1/week'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Five weeks of double kettlebell strength work.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('Week 2')).toBeInTheDocument();
    expect(screen.getByText('Day 1 · Press Ladders')).toBeInTheDocument();
    expect(screen.getByText('Day 1 · Clean & Press')).toBeInTheDocument();
    // Movement summary + goal label appear per session (both sessions share them).
    expect(
      screen.getAllByText('Double Kettlebell Press · Kettlebell Swing'),
    ).toHaveLength(2);
    expect(screen.getAllByText('20 min')).toHaveLength(2);
  });

  it('pre-fills the starting weight from the program and enrolls on Start', () => {
    enrollMutate.mockImplementation((_input, { onSuccess }) => onSuccess());

    renderPage();

    // DFW is double-24: two weight inputs pre-filled at 24.
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue(24);
    expect(inputs[1]).toHaveValue(24);

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(enrollMutate).toHaveBeenCalledWith(
      {
        programId: 'dfw-1',
        sharedWeightOneValue: 24,
        sharedWeightOneUnit: 'kilograms',
        sharedWeightTwoValue: 24,
        sharedWeightTwoUnit: 'kilograms',
      },
      expect.anything(),
    );
    // Enroll success lands on home.
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('pre-fills single loading at the modal weight for a single-bell program', () => {
    mockUseProgram.mockReturnValue({
      data: {
        program: { ...dfw, id: 'snatch-1', title: 'Snatch Test Plan' },
        sessions: [
          sharedSession(0, 1, 1, 'Snatches', 24, 0),
          sharedSession(1, 1, 2, 'Snatches', 24, 0),
        ],
      },
      isLoading: false,
      isError: false,
    });

    renderPage('snatch-1');

    // Single-bell collapses to one weight input at the modal 24kg.
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toHaveValue(24);

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(enrollMutate).toHaveBeenCalledWith(
      {
        programId: 'snatch-1',
        sharedWeightOneValue: 24,
        sharedWeightOneUnit: 'kilograms',
        sharedWeightTwoValue: 0,
        sharedWeightTwoUnit: null,
      },
      expect.anything(),
    );
  });

  it('prompts to switch when a different program is already active, then enrolls on confirm', () => {
    mockUseActiveProgram.mockReturnValue({
      data: {
        enrollment: { programId: 'other-program', status: 'active' },
        program: { title: 'Other Program' },
      },
    });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    // The switch prompt gates the RPC until confirmed.
    expect(enrollMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Switch program?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch program' }));

    expect(enrollMutate).toHaveBeenCalledWith(
      {
        programId: 'dfw-1',
        sharedWeightOneValue: 24,
        sharedWeightOneUnit: 'kilograms',
        sharedWeightTwoValue: 24,
        sharedWeightTwoUnit: 'kilograms',
      },
      expect.anything(),
    );
  });

  it('redirects an own-program deep link to its progress page', () => {
    mockUseProgram.mockReturnValue({
      data: {
        program: { ...dfw, id: 'mine-1', ownerId: 'user-123', isPublic: false },
        sessions: dfwSessions,
      },
      isLoading: false,
      isError: false,
    });

    renderPage('mine-1');

    expect(screen.getByText('progress page')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Start program' }),
    ).not.toBeInTheDocument();
  });

  it('renders a not-found state on error', () => {
    mockUseProgram.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    renderPage();

    expect(screen.getByText('Program not found.')).toBeInTheDocument();
  });
});
