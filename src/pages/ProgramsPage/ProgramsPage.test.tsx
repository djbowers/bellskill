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
  enrollMutate,
  createMutate,
} = vi.hoisted(() => ({
  mockUsePrograms: vi.fn(),
  mockUseActiveProgram: vi.fn(),
  mockUseCreateProgram: vi.fn(),
  mockUseEnrollProgram: vi.fn(),
  enrollMutate: vi.fn(),
  createMutate: vi.fn(),
}));

vi.mock('~/api', () => ({
  usePrograms: mockUsePrograms,
  useActiveProgram: mockUseActiveProgram,
  useCreateProgram: mockUseCreateProgram,
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
  });

  it('prompts for a starting weight before enrolling in a shared program, defaulted to double 24kg', () => {
    renderPage();

    fireEvent.click(screen.getByText('Start Dry Fighting Weight'));

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

  it('enrolls with mixed independent left/right weights', () => {
    renderPage();

    fireEvent.click(screen.getByText('Start Dry Fighting Weight'));
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

    fireEvent.click(screen.getByText('Start Dry Fighting Weight'));
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

    fireEvent.click(screen.getByText('Start Dry Fighting Weight'));
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

    fireEvent.click(screen.getByText('Start Dry Fighting Weight'));

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

  it('renders one card per shared program, each with its own enroll button', () => {
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

    fireEvent.click(screen.getByText('Start Armor Building Complex'));

    // The switch prompt gates the RPC until confirmed.
    expect(enrollMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Switch program?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch program' }));

    expect(enrollMutate).toHaveBeenCalledWith('armor-1', expect.anything());
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
