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

// One movement in a session's `movements[]`. The weight config is read from the
// null-pattern: weightOne null → bodyweight, weightTwo null → two-hand single,
// weightTwo 0 → single, weightTwo > 0 → double.
const movement = (
  movementName: string,
  weightOne: number | null,
  weightTwo: number | null,
) => ({
  movementName,
  repScheme: [5],
  weightOneValue: weightOne,
  weightOneUnit: weightOne === null ? null : ('kilograms' as const),
  weightTwoValue: weightTwo,
  weightTwoUnit:
    weightTwo === null || weightTwo === 0 ? null : ('kilograms' as const),
});

const session = (
  seq: number,
  week: number,
  day: number,
  title: string,
  movements: ReturnType<typeof movement>[],
  { complexSet = false }: { complexSet?: boolean } = {},
) => ({
  id: `s-${seq}`,
  programId: 'p-1',
  sequenceIndex: seq,
  weekNumber: week,
  dayNumber: day,
  title,
  notes: null,
  weightLabel: null,
  workoutOptions: {
    complexSet,
    intervalTimer: 0,
    restTimer: 0,
    title: null,
    preWorkoutNotes: null,
    workoutGoal: 20,
    workoutGoalUnits: 'minutes',
    sharedWeightOneValue: null,
    sharedWeightOneUnit: null,
    sharedWeightTwoValue: null,
    sharedWeightTwoUnit: null,
    movements,
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

// Two double-bell movements at a flat 24 kg.
const dfwSessions = [
  session(0, 1, 1, 'Press Ladders', [
    movement('Double Kettlebell Press', 24, 24),
    movement('Kettlebell Swing', 24, 24),
  ]),
  session(1, 2, 1, 'Clean & Press', [
    movement('Double Kettlebell Press', 24, 24),
    movement('Kettlebell Swing', 24, 24),
  ]),
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

  it('renders one control per movement, pre-filled, and enrolls per movement', () => {
    enrollMutate.mockImplementation((_input, { onSuccess }) => onSuccess());

    renderPage();

    // A heading per distinct movement (separate from the session summary spans).
    expect(
      screen.getByRole('heading', { name: 'Double Kettlebell Press' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Kettlebell Swing' }),
    ).toBeInTheDocument();

    // Two double movements → two bell inputs each, all pre-filled at 24.
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(4);
    inputs.forEach((input) => expect(input).toHaveValue(24));

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(enrollMutate).toHaveBeenCalledWith(
      {
        programId: 'dfw-1',
        movementWeights: [
          {
            movementName: 'Double Kettlebell Press',
            weightOneValue: 24,
            weightOneUnit: 'kilograms',
            weightTwoValue: 24,
            weightTwoUnit: 'kilograms',
          },
          {
            movementName: 'Kettlebell Swing',
            weightOneValue: 24,
            weightOneUnit: 'kilograms',
            weightTwoValue: 24,
            weightTwoUnit: 'kilograms',
          },
        ],
      },
      expect.anything(),
    );
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('sends each movement in its own config shape, omitting bodyweight', () => {
    mockUseProgram.mockReturnValue({
      data: {
        program: { ...dfw, id: 'es-1', title: 'Easy Strength' },
        sessions: [
          session(0, 1, 1, '2x5', [
            movement('Double Kettlebell Front Squat', 24, 24),
            movement('Pull-Up', null, null),
            movement('Kettlebell Swing', 24, null),
          ]),
        ],
      },
      isLoading: false,
      isError: false,
    });

    renderPage('es-1');

    // Bodyweight movement shows a label, no picker; the single swing collapses to
    // one input; the double squat keeps two — three inputs total.
    expect(
      screen.getByRole('heading', { name: 'Pull-Up' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Bodyweight')).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(enrollMutate).toHaveBeenCalledWith(
      {
        programId: 'es-1',
        movementWeights: [
          {
            movementName: 'Double Kettlebell Front Squat',
            weightOneValue: 24,
            weightOneUnit: 'kilograms',
            weightTwoValue: 24,
            weightTwoUnit: 'kilograms',
          },
          {
            movementName: 'Kettlebell Swing',
            weightOneValue: 24,
            weightOneUnit: 'kilograms',
            weightTwoValue: null,
            weightTwoUnit: null,
          },
        ],
      },
      expect.anything(),
    );
  });

  it('edits one movement independently of the others', () => {
    renderPage();

    // Drop only the swing; the press stays put.
    fireEvent.change(screen.getByLabelText('Kettlebell Swing bell 1'), {
      target: { value: '20' },
    });
    expect(screen.getByLabelText('Double Kettlebell Press bell 1')).toHaveValue(
      24,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(enrollMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        movementWeights: [
          expect.objectContaining({
            movementName: 'Double Kettlebell Press',
            weightOneValue: 24,
          }),
          expect.objectContaining({
            movementName: 'Kettlebell Swing',
            weightOneValue: 20,
          }),
        ],
      }),
      expect.anything(),
    );
  });

  it('pre-fills each movement at its own modal weight across sessions', () => {
    // A heavier test day: the press runs at 24 on two working days and 28 once,
    // so its modal (and pre-fill) is 24 — the RPC applies the per-session offset.
    mockUseProgram.mockReturnValue({
      data: {
        program: { ...dfw, id: 'dfw-1' },
        sessions: [
          ...dfwSessions,
          session(2, 5, 1, 'Test - new press max', [
            movement('Double Kettlebell Press', 28, 28),
            movement('Kettlebell Swing', 28, 28),
          ]),
        ],
      },
      isLoading: false,
      isError: false,
    });

    renderPage();

    // No separate "test day" control — one control per movement, at the modal 24.
    expect(screen.getByLabelText('Double Kettlebell Press bell 1')).toHaveValue(
      24,
    );
    expect(screen.getAllByRole('spinbutton')).toHaveLength(4);
  });

  it('uses a single shared weight for a complex-set program', () => {
    mockUseProgram.mockReturnValue({
      data: {
        program: { ...dfw, id: 'abc-1', title: 'Armor Building Complex' },
        sessions: [
          session(
            0,
            1,
            1,
            '5 rounds',
            [
              movement('Double Kettlebell Clean', 24, 24),
              movement('Double Kettlebell Military Press', 24, 24),
              movement('Double Kettlebell Front Squat', 24, 24),
            ],
            { complexSet: true },
          ),
        ],
      },
      isLoading: false,
      isError: false,
    });

    renderPage('abc-1');

    // One shared picker (two bells) for the whole complex — not one per movement.
    expect(
      screen.queryByRole('heading', { name: 'Double Kettlebell Clean' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(enrollMutate).toHaveBeenCalledWith(
      {
        programId: 'abc-1',
        sharedWeightOneValue: 24,
        sharedWeightOneUnit: 'kilograms',
        sharedWeightTwoValue: 24,
        sharedWeightTwoUnit: 'kilograms',
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
      expect.objectContaining({
        programId: 'dfw-1',
        replaceUserProgramId: undefined,
        movementWeights: expect.any(Array),
      }),
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
      expect.objectContaining({
        programId: 'dfw-1',
        replaceUserProgramId: 'up-1',
        movementWeights: expect.any(Array),
      }),
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

  it('defaults the repeat toggle from the program and passes it to enroll', () => {
    // No navigating onSuccess here: keep the page mounted so the toggle can be
    // flipped and Start clicked a second time.
    mockUseProgram.mockReturnValue({
      data: {
        program: {
          ...dfw,
          id: 'ss-1',
          title: 'Simple & Sinister',
          defaultAutoRepeat: true,
        },
        sessions: [
          session(0, 1, 1, '100 swings + 10 get-ups', [
            movement('One-Arm Kettlebell Swing', 24, 0),
          ]),
        ],
      },
      isLoading: false,
      isError: false,
    });

    renderPage('ss-1');

    // A repeating program pre-checks the toggle...
    const toggle = screen.getByRole('switch', {
      name: /repeat automatically/i,
    });
    expect(toggle).toBeChecked();

    // ...and enrolling carries autoRepeat true.
    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));
    expect(enrollMutate).toHaveBeenCalledWith(
      expect.objectContaining({ programId: 'ss-1', autoRepeat: true }),
      expect.anything(),
    );

    // Unchecking it and re-enrolling flips the flag off.
    enrollMutate.mockClear();
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));
    expect(enrollMutate).toHaveBeenCalledWith(
      expect.objectContaining({ autoRepeat: false }),
      expect.anything(),
    );
  });
});
