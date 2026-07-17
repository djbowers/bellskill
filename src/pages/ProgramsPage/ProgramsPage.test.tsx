import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { ProgramsPage } from './ProgramsPage';

const {
  mockUsePrograms,
  mockUseActiveProgram,
  mockUseCreateProgram,
  mockUseEnrollProgram,
  mockUseProgram,
  enrollMutate,
  createMutate,
} = vi.hoisted(() => ({
  mockUsePrograms: vi.fn(),
  mockUseActiveProgram: vi.fn(),
  mockUseCreateProgram: vi.fn(),
  mockUseEnrollProgram: vi.fn(),
  mockUseProgram: vi.fn(),
  enrollMutate: vi.fn(),
  createMutate: vi.fn(),
}));

vi.mock('~/api', () => ({
  usePrograms: mockUsePrograms,
  useActiveProgram: mockUseActiveProgram,
  useCreateProgram: mockUseCreateProgram,
  useEnrollProgram: mockUseEnrollProgram,
  useProgram: mockUseProgram,
}));

vi.mock('~/contexts', async () => {
  const actual =
    await vi.importActual<typeof import('~/contexts')>('~/contexts');
  return {
    ...actual,
    useSession: () => ({ user: { id: 'user-123' } }),
  };
});

const dfw = {
  id: 'dfw-1',
  ownerId: null,
  sourceProgramId: null,
  slug: 'dry-fighting-weight',
  title: 'Dry Fighting Weight',
  description: null,
  authorName: 'Geoff Neupert',
  numWeeks: 5,
  daysPerWeek: 3,
  isPublic: true,
  createdAt: '',
};

const armor = {
  id: 'armor-1',
  ownerId: null,
  sourceProgramId: null,
  slug: 'armor-building-complex',
  title: 'Armor Building Complex',
  description: null,
  authorName: 'Dan John',
  numWeeks: 6,
  daysPerWeek: 3,
  isPublic: true,
  createdAt: '',
};

const myProgram = {
  id: 'mine-1',
  ownerId: 'user-123',
  sourceProgramId: null,
  slug: null,
  title: 'My Program',
  description: null,
  authorName: null,
  numWeeks: 4,
  daysPerWeek: 3,
  isPublic: false,
  createdAt: '',
};

const snatchTest = {
  id: 'snatch-1',
  ownerId: null,
  sourceProgramId: null,
  slug: 'strongfirst-snatch-test-plan',
  title: 'Snatch Test Plan',
  description: null,
  authorName: 'StrongFirst',
  numWeeks: 10,
  daysPerWeek: 3,
  isPublic: true,
  createdAt: '',
};

// Minimal session whose first movement carries the given loading. `weightTwo`
// null → two-hand, 0 → single, >0 → double.
const sessionWith = (
  weightOne: number,
  weightTwo: number | null,
  shared = false,
) => ({
  id: 's',
  programId: 'p',
  sequenceIndex: 0,
  weekNumber: 1,
  dayNumber: 1,
  title: 't',
  notes: null,
  workoutOptions: {
    complexSet: shared,
    intervalTimer: 0,
    restTimer: 0,
    workoutDetails: null,
    workoutGoal: 0,
    workoutGoalUnits: 'minutes',
    sharedWeightOneValue: shared ? weightOne : null,
    sharedWeightOneUnit: shared ? 'kilograms' : null,
    sharedWeightTwoValue: shared ? weightTwo : null,
    sharedWeightTwoUnit: shared && weightTwo ? 'kilograms' : null,
    movements: [
      {
        movementName: 'M',
        repScheme: [1],
        weightOneValue: weightOne,
        weightOneUnit: 'kilograms',
        weightTwoValue: weightTwo,
        weightTwoUnit: weightTwo ? 'kilograms' : null,
      },
    ],
  },
});

// Sessions for each seeded shared program, keyed by id, so the starting-weight
// prompt derives its pre-fill from real per-program loading profiles.
const SESSIONS_BY_ID: Record<string, ReturnType<typeof sessionWith>[]> = {
  'dfw-1': Array.from({ length: 13 }, () => sessionWith(24, 24)).concat(
    sessionWith(28, 28),
  ),
  'armor-1': Array.from({ length: 20 }, () => sessionWith(24, 24, true)),
  'snatch-1': [
    ...Array.from({ length: 9 }, () => sessionWith(28, 0)),
    ...Array.from({ length: 11 }, () => sessionWith(24, 0)),
    ...Array.from({ length: 10 }, () => sessionWith(20, 0)),
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/programs']}>
      <Routes>
        <Route path="/programs" element={<ProgramsPage />} />
        <Route
          path="/programs/:id/sessions/new"
          element={<div>builder for program</div>}
        />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ProgramsPage', () => {
  beforeEach(() => {
    enrollMutate.mockReset();
    createMutate.mockReset();
    mockUsePrograms.mockReturnValue({
      data: [dfw, myProgram],
      isLoading: false,
    });
    mockUseActiveProgram.mockReturnValue({ data: null });
    mockUseCreateProgram.mockReturnValue({
      mutate: createMutate,
      isLoading: false,
    });
    mockUseEnrollProgram.mockReturnValue({
      mutate: enrollMutate,
      isLoading: false,
    });
    mockUseProgram.mockImplementation((id?: string) => ({
      data: id
        ? { program: {}, sessions: SESSIONS_BY_ID[id] ?? [] }
        : undefined,
    }));
  });

  it('prompts for a starting weight before enrolling in a shared program, defaulted to double 24kg', () => {
    renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Start Dry Fighting Weight' }),
    );

    // The RPC is not called yet — the starting-weight prompt is shown first,
    // defaulting to double loading (two weight inputs) at 24kg each.
    expect(enrollMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Starting weight')).toBeInTheDocument();
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
  });

  it('degrades to the editable double-24kg default when the program fetch errors', () => {
    mockUseProgram.mockReturnValue({ data: undefined, isError: true });

    renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Start Dry Fighting Weight' }),
    );

    // A failed sessions fetch must not brick enrollment: the picker still opens
    // editable on the generic double-24kg fallback rather than sticking on
    // "Loading…" with a disabled button.
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveValue(24);
    expect(inputs[1]).toHaveValue(24);

    const startButton = screen.getByRole('button', { name: 'Start program' });
    expect(startButton).not.toBeDisabled();

    fireEvent.click(startButton);

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

  it('pre-fills single loading at the modal weight for a single-bell program', () => {
    mockUsePrograms.mockReturnValue({
      data: [snatchTest, myProgram],
      isLoading: false,
    });

    renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Start Snatch Test Plan' }),
    );

    // A single-bell program (Snatch Test) collapses to one weight input at the
    // modal 24kg — not the double-24 the fixed default used to force.
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

  it('omits the Bodyweight mode from the starting-weight prompt', () => {
    renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Start Dry Fighting Weight' }),
    );

    expect(
      screen.queryByRole('tab', { name: 'Bodyweight' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Two-Hand' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Single' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Double' })).toBeInTheDocument();
  });

  it('enrolls with mixed independent left/right weights', () => {
    renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Start Dry Fighting Weight' }),
    );
    // Left bell stays 24kg, right bell drops to 16kg (mixed pair).
    fireEvent.change(screen.getAllByRole('spinbutton')[1], {
      target: { value: '16' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(enrollMutate).toHaveBeenCalledWith(
      {
        programId: 'dfw-1',
        sharedWeightOneValue: 24,
        sharedWeightOneUnit: 'kilograms',
        sharedWeightTwoValue: 16,
        sharedWeightTwoUnit: 'kilograms',
      },
      expect.anything(),
    );
  });

  it('enrolls with a single two-hand weight when the Two-Hand mode is selected', async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Start Dry Fighting Weight' }),
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Two-Hand' }));

    // Two-hand loading collapses to one weight input; weight two clears.
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(enrollMutate).toHaveBeenCalledWith(
      {
        programId: 'dfw-1',
        sharedWeightOneValue: 24,
        sharedWeightOneUnit: 'kilograms',
        sharedWeightTwoValue: null,
        sharedWeightTwoUnit: null,
      },
      expect.anything(),
    );
  });

  it('enrolls with a per-slot unit choice (kg or lb)', async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Start Dry Fighting Weight' }),
    );
    // Switch only the left bell to pounds; the right bell stays in kg.
    await userEvent.click(screen.getAllByRole('tab', { name: 'lb' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(enrollMutate).toHaveBeenCalledWith(
      {
        programId: 'dfw-1',
        sharedWeightOneValue: 24,
        sharedWeightOneUnit: 'pounds',
        sharedWeightTwoValue: 24,
        sharedWeightTwoUnit: 'kilograms',
      },
      expect.anything(),
    );
  });

  it('preserves the selected unit (lb) across a loading-mode switch', async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Start Dry Fighting Weight' }),
    );
    await userEvent.click(screen.getAllByRole('tab', { name: 'lb' })[0]);
    await userEvent.click(screen.getByRole('tab', { name: 'Two-Hand' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(enrollMutate).toHaveBeenCalledWith(
      {
        programId: 'dfw-1',
        sharedWeightOneValue: 24,
        sharedWeightOneUnit: 'pounds',
        sharedWeightTwoValue: null,
        sharedWeightTwoUnit: null,
      },
      expect.anything(),
    );
  });

  it('enrolls in your own program directly, with no starting-weight prompt', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(screen.queryByText('Starting weight')).not.toBeInTheDocument();
    expect(enrollMutate).toHaveBeenCalledWith(
      { programId: 'mine-1' },
      expect.anything(),
    );
  });

  it('prompts to switch when a different program is already active, then prompts for starting weight on confirm', () => {
    mockUseActiveProgram.mockReturnValue({
      data: {
        enrollment: { programId: 'other-program', status: 'active' },
        program: { title: 'Other Program' },
      },
    });

    renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Start Dry Fighting Weight' }),
    );

    // The RPC is not called yet — the switch prompt is shown first.
    expect(enrollMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Switch program?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch program' }));

    // Confirming the switch leads into the starting-weight prompt.
    expect(enrollMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Starting weight')).toBeInTheDocument();

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
  });

  it('renders a compact row per shared program, each with its own enroll button', () => {
    mockUsePrograms.mockReturnValue({
      data: [dfw, armor, myProgram],
      isLoading: false,
    });

    renderPage();

    expect(screen.getByText('Dry Fighting Weight')).toBeInTheDocument();
    expect(screen.getByText('Armor Building Complex')).toBeInTheDocument();
    expect(screen.getByText('Dan John · 6 weeks · 3/week')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start Dry Fighting Weight' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Start Armor Building Complex' }),
    ).toBeInTheDocument();
  });

  it('enrolls in a non-DFW shared program, prompting to switch when another is active', () => {
    mockUsePrograms.mockReturnValue({
      data: [dfw, armor, myProgram],
      isLoading: false,
    });
    mockUseActiveProgram.mockReturnValue({
      data: {
        enrollment: { programId: 'other-program', status: 'active' },
        program: { title: 'Other Program' },
      },
    });

    renderPage();

    fireEvent.click(
      screen.getByRole('button', { name: 'Start Armor Building Complex' }),
    );

    // The switch prompt gates the RPC until confirmed.
    expect(enrollMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Switch program?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch program' }));

    // Confirming the switch leads into the starting-weight prompt.
    expect(enrollMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Starting weight')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    expect(enrollMutate).toHaveBeenCalledWith(
      {
        programId: 'armor-1',
        sharedWeightOneValue: 24,
        sharedWeightOneUnit: 'kilograms',
        sharedWeightTwoValue: 24,
        sharedWeightTwoUnit: 'kilograms',
      },
      expect.anything(),
    );
  });

  it('creates a program from the inline form and navigates into the builder', () => {
    createMutate.mockImplementation((_input, { onSuccess }) =>
      onSuccess({ id: 'mine-1' }),
    );

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Create program' }));
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'New Program' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Create and add sessions' }),
    );

    expect(createMutate).toHaveBeenCalledWith(
      { title: 'New Program', numWeeks: 5, daysPerWeek: 3 },
      expect.anything(),
    );
    expect(screen.getByText('builder for program')).toBeInTheDocument();
  });
});
