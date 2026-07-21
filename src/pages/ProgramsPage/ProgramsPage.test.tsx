import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { ProgramsPage } from './ProgramsPage';

const {
  mockUsePrograms,
  mockUseActiveProgram,
  mockUseCreateProgram,
  mockUseEnrollProgram,
  mockUseResumeProgram,
  mockUseProgramProgress,
  mockUseCancelProgram,
  mockUseDeleteProgram,
  mockUseSetProgramArchived,
  mockTrackEvent,
  enrollMutate,
  resumeMutate,
  createMutate,
  cancelMutate,
  deleteMutate,
  setArchivedMutate,
} = vi.hoisted(() => ({
  mockUsePrograms: vi.fn(),
  mockUseActiveProgram: vi.fn(),
  mockUseCreateProgram: vi.fn(),
  mockUseEnrollProgram: vi.fn(),
  mockUseResumeProgram: vi.fn(),
  mockUseProgramProgress: vi.fn(),
  mockUseCancelProgram: vi.fn(),
  mockUseDeleteProgram: vi.fn(),
  mockUseSetProgramArchived: vi.fn(),
  mockTrackEvent: vi.fn(),
  enrollMutate: vi.fn(),
  resumeMutate: vi.fn(),
  createMutate: vi.fn(),
  cancelMutate: vi.fn(),
  deleteMutate: vi.fn(),
  setArchivedMutate: vi.fn(),
}));

vi.mock('~/api', () => ({
  usePrograms: mockUsePrograms,
  useActiveProgram: mockUseActiveProgram,
  useCreateProgram: mockUseCreateProgram,
  useEnrollProgram: mockUseEnrollProgram,
  useResumeProgram: mockUseResumeProgram,
  useProgramProgress: mockUseProgramProgress,
  useCancelProgram: mockUseCancelProgram,
  useDeleteProgram: mockUseDeleteProgram,
  useSetProgramArchived: mockUseSetProgramArchived,
  trackEvent: mockTrackEvent,
  AnalyticsEvent: { ProgramResumed: 'program_resumed' },
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
    resumeMutate.mockReset();
    createMutate.mockReset();
    cancelMutate.mockReset();
    deleteMutate.mockReset();
    setArchivedMutate.mockReset();
    mockTrackEvent.mockReset();
    mockUsePrograms.mockReturnValue({
      data: [dfw, myProgram],
      isLoading: false,
    });
    mockUseActiveProgram.mockReturnValue({ data: null });
    mockUseCreateProgram.mockReturnValue({
      mutate: createMutate,
      isPending: false,
    });
    mockUseEnrollProgram.mockReturnValue({
      mutate: enrollMutate,
      isPending: false,
    });
    mockUseResumeProgram.mockReturnValue({
      mutate: resumeMutate,
      isPending: false,
    });
    // Default: no prior progress for any candidate, so an own-program "Start"
    // routes straight to a fresh enroll. Individual tests override this.
    mockUseProgramProgress.mockImplementation((id?: string) => ({
      data: id
        ? { program: { id }, enrollment: null, completedCount: 0 }
        : undefined,
      isError: false,
    }));
    mockUseCancelProgram.mockReturnValue({
      mutate: cancelMutate,
      isPending: false,
    });
    mockUseDeleteProgram.mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    });
    mockUseSetProgramArchived.mockReturnValue({
      mutate: setArchivedMutate,
      isPending: false,
    });
  });

  it('links each shared program row to its details view instead of enrolling inline', () => {
    mockUsePrograms.mockReturnValue({
      data: [dfw, armor, myProgram],
      isLoading: false,
    });

    renderPage();

    expect(screen.getByText('Dry Fighting Weight')).toBeInTheDocument();
    expect(screen.getByText('Armor Building Complex')).toBeInTheDocument();
    expect(screen.getByText('Dan John · 6 weeks · 3/week')).toBeInTheDocument();

    // Rows navigate to the pre-enroll details page — starting now happens there.
    expect(
      screen.getByRole('link', { name: 'View Dry Fighting Weight' }),
    ).toHaveAttribute('href', '/programs/dfw-1/details');
    expect(
      screen.getByRole('link', { name: 'View Armor Building Complex' }),
    ).toHaveAttribute('href', '/programs/armor-1/details');

    // The old per-row Start button is gone; no starting-weight prompt here.
    expect(
      screen.queryByRole('button', { name: 'Start Dry Fighting Weight' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Starting weight')).not.toBeInTheDocument();
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

  it('offers resume vs start-over for a program with prior progress, and resumes on confirm', () => {
    mockUseProgramProgress.mockImplementation((id?: string) => ({
      data:
        id === 'mine-1'
          ? {
              program: { id: 'mine-1' },
              enrollment: { id: 'up-9', status: 'completed' },
              completedCount: 3,
            }
          : id
            ? { program: { id }, enrollment: null, completedCount: 0 }
            : undefined,
      isError: false,
    }));
    resumeMutate.mockImplementation((_input, { onSuccess }) => onSuccess());

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));

    // Prior progress gates the fresh enroll behind a resume-vs-start-over choice.
    expect(enrollMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Resume this program?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

    // Resumes by the exact enrollment id the prompt is showing, not the program.
    expect(resumeMutate).toHaveBeenCalledWith(
      { userProgramId: 'up-9' },
      expect.anything(),
    );
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'program_resumed' }),
    );
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('starts a prior-progress program over on the start-over choice', () => {
    mockUseProgramProgress.mockImplementation((id?: string) => ({
      data:
        id === 'mine-1'
          ? {
              program: { id: 'mine-1' },
              enrollment: { id: 'up-9', status: 'abandoned' },
              completedCount: 2,
            }
          : id
            ? { program: { id }, enrollment: null, completedCount: 0 }
            : undefined,
      isError: false,
    }));

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Start program' }));
    expect(screen.getByText('Resume this program?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));

    expect(resumeMutate).not.toHaveBeenCalled();
    expect(enrollMutate).toHaveBeenCalledWith(
      { programId: 'mine-1' },
      expect.anything(),
    );
  });

  it('shows "No sessions yet" for a program whose cadence is not derived yet', () => {
    mockUsePrograms.mockReturnValue({
      data: [{ ...myProgram, numWeeks: null, daysPerWeek: null }],
      isLoading: false,
    });

    renderPage();

    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
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
      { title: 'New Program' },
      expect.anything(),
    );
    expect(screen.getByText('builder for program')).toBeInTheDocument();
  });

  it('cancels the active program only after confirming', () => {
    mockUseActiveProgram.mockReturnValue({
      data: {
        enrollment: { id: 'up-1', programId: 'mine-1', status: 'active' },
        program: { title: 'My Program' },
      },
    });

    renderPage();

    // The management "Cancel" surfaces only on the active card.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // The RPC is gated behind an explicit confirm (progress is discarded).
    expect(cancelMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Cancel program?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel program' }));

    expect(cancelMutate).toHaveBeenCalledWith({ userProgramId: 'up-1' });
  });

  it('hard-deletes a program only after an explicit confirm', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    // Irreversible — nothing happens until the confirm dialog is accepted.
    expect(deleteMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Delete program?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));

    expect(deleteMutate).toHaveBeenCalledWith({ programId: 'mine-1' });
  });

  it('archives a live program (no confirm — it is reversible)', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));

    expect(setArchivedMutate).toHaveBeenCalledWith({
      programId: 'mine-1',
      archived: true,
    });
  });

  it('hides archived programs behind a toggle and restores them', () => {
    const archived = {
      ...myProgram,
      id: 'arch-1',
      title: 'Old Program',
      archivedAt: '2026-07-01T00:00:00Z',
    };
    mockUsePrograms.mockReturnValue({
      data: [dfw, myProgram, archived],
      isLoading: false,
    });

    renderPage();

    // Archived programs are hidden from the default list.
    expect(screen.queryByText('Old Program')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show archived (1)' }));
    expect(screen.getByText('Old Program')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    expect(setArchivedMutate).toHaveBeenCalledWith({
      programId: 'arch-1',
      archived: false,
    });
  });
});
