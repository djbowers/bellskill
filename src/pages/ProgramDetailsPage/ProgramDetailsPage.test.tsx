import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { ProgramDetailsPage } from './ProgramDetailsPage';

const {
  mockUseProgram,
  mockUseActivePrograms,
  mockUseEnrollProgram,
  enrollMutate,
} = vi.hoisted(() => ({
  mockUseProgram: vi.fn(),
  mockUseActivePrograms: vi.fn(),
  mockUseEnrollProgram: vi.fn(),
  enrollMutate: vi.fn(),
}));

vi.mock('~/api', () => ({
  useProgram: mockUseProgram,
  useActivePrograms: mockUseActivePrograms,
  useEnrollProgram: mockUseEnrollProgram,
  MAX_ACTIVE_PROGRAMS: 3,
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
  weightLabel: string | null = null,
) => ({
  id: `s-${seq}`,
  programId: 'dfw-1',
  sequenceIndex: seq,
  weekNumber: week,
  dayNumber: day,
  title,
  notes: null,
  weightLabel,
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
    mockUseActivePrograms.mockReturnValue({ data: [] });
    mockUseEnrollProgram.mockReturnValue({
      mutate: enrollMutate,
      isPending: false,
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

    // The loading mode is fixed by the program's sessions — no mode tabs to
    // switch a two-hand program into double bells (mirrors #150).
    expect(
      screen.queryByRole('tab', { name: 'Two-Hand' }),
    ).not.toBeInTheDocument();

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

  const activeProgram = (id: string, title: string) => ({
    enrollment: { id, programId: `${id}-program`, status: 'active' },
    program: { title },
    progress: { completed: 0, total: 3 },
  });

  it('starts alongside an existing program with no prompt while a slot is free', () => {
    mockUseActivePrograms.mockReturnValue({
      data: [activeProgram('up-1', 'Other Program')],
    });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(screen.queryByText('Replace a program?')).not.toBeInTheDocument();
    expect(enrollMutate).toHaveBeenCalledWith(
      {
        programId: 'dfw-1',
        sharedWeightOneValue: 24,
        sharedWeightOneUnit: 'kilograms',
        sharedWeightTwoValue: 24,
        sharedWeightTwoUnit: 'kilograms',
        replaceUserProgramId: undefined,
      },
      expect.anything(),
    );
  });

  it('prompts to replace once every slot is taken, then enrolls displacing the first', () => {
    mockUseActivePrograms.mockReturnValue({
      data: [
        activeProgram('up-1', 'Least Recent'),
        activeProgram('up-2', 'Middle'),
        activeProgram('up-3', 'Most Recent'),
      ],
    });

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    // The replace prompt gates the RPC until confirmed.
    expect(enrollMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Replace a program?')).toBeInTheDocument();
    // The displaced program is named, never silently dropped.
    expect(screen.getByText(/Least Recent/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Replace program' }));

    expect(enrollMutate).toHaveBeenCalledWith(
      {
        programId: 'dfw-1',
        sharedWeightOneValue: 24,
        sharedWeightOneUnit: 'kilograms',
        sharedWeightTwoValue: 24,
        sharedWeightTwoUnit: 'kilograms',
        replaceUserProgramId: 'up-1',
      },
      expect.anything(),
    );
  });

  // A program whose sessions run at two different weights: 24kg working plus a
  // deliberately heavier 28kg test day, the shape enroll_in_program offsets.
  const withTestDay = (weightLabel: string | null = 'Test day') => ({
    data: {
      program: { ...dfw, id: 'dfw-1' },
      sessions: [
        ...dfwSessions,
        sharedSession(2, 5, 1, 'Test - new press max', 28, 28, weightLabel),
      ],
    },
    isLoading: false,
    isError: false,
  });

  it('renders no extra control for a program that runs at one weight', () => {
    renderPage();

    expect(screen.getByText('Starting weight')).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
  });

  it('adds a control per extra weight group, labelled from the seed', () => {
    mockUseProgram.mockReturnValue(withTestDay());

    renderPage();

    expect(screen.getByText('Test day')).toBeInTheDocument();
    expect(screen.getByText('4 kg heavier · week 5')).toBeInTheDocument();
    // Working double-24 (2 inputs) + the test day's double-28 (2 more).
    expect(screen.getByLabelText('Test day bell 1')).toHaveValue(28);
    expect(screen.getByLabelText('Test day bell 2')).toHaveValue(28);
  });

  it('describes an unlabelled group by its offset instead', () => {
    mockUseProgram.mockReturnValue(withTestDay(null));

    renderPage();

    expect(screen.getAllByText('4 kg heavier · week 5').length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText('Test day')).not.toBeInTheDocument();
  });

  it('an untouched group follows the working weight, and pins once edited', () => {
    mockUseProgram.mockReturnValue(withTestDay());

    renderPage();

    // Drop the working bell 24 → 20; the test day rides along, staying +4.
    fireEvent.click(
      screen.getByRole('button', { name: '- kg — Starting weight bell 1' }),
    );
    expect(screen.getByLabelText('Starting weight bell 1')).toHaveValue(23);
    expect(screen.getByLabelText('Test day bell 1')).toHaveValue(27);

    // Editing the test day pins it: further working-weight changes leave it.
    fireEvent.change(screen.getByLabelText('Test day bell 1'), {
      target: { value: '32' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: '- kg — Starting weight bell 1' }),
    );
    expect(screen.getByLabelText('Starting weight bell 1')).toHaveValue(22);
    expect(screen.getByLabelText('Test day bell 1')).toHaveValue(32);
  });

  it('sends the chosen group weights as enroll overrides, keyed by source weight', () => {
    mockUseProgram.mockReturnValue(withTestDay());

    renderPage();

    fireEvent.change(screen.getByLabelText('Test day bell 1'), {
      target: { value: '32' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(enrollMutate).toHaveBeenCalledWith(
      {
        programId: 'dfw-1',
        sharedWeightOneValue: 24,
        sharedWeightOneUnit: 'kilograms',
        sharedWeightTwoValue: 24,
        sharedWeightTwoUnit: 'kilograms',
        weightOverrides: [
          {
            sourceWeightOneValue: 28,
            sourceWeightTwoValue: 28,
            weightOneValue: 32,
            weightOneUnit: 'kilograms',
            weightTwoValue: 28,
            weightTwoUnit: 'kilograms',
          },
        ],
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
