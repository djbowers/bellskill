import { fireEvent, render, screen } from '@testing-library/react';
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

  it('offers a one-tap "Start Dry Fighting Weight" that enrolls directly when no program is active', () => {
    renderPage();

    fireEvent.click(screen.getByText('Start Dry Fighting Weight'));

    expect(enrollMutate).toHaveBeenCalledWith('dfw-1', expect.anything());
  });

  it('prompts to switch when a different program is already active, then enrolls on confirm', () => {
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

    expect(enrollMutate).toHaveBeenCalledWith('dfw-1', expect.anything());
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
