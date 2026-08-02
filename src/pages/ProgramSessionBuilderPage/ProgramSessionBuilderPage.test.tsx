import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { ProgramSessionBuilderPage } from './ProgramSessionBuilderPage';

const {
  mockUseProgram,
  mockUseSaveProgramSession,
  mockUseUpdateProgramSession,
  mockUseDeleteProgramSession,
  mockUseDuplicateProgramSession,
  mockUseDuplicateProgramWeek,
  mockUseReorderProgramSessions,
  mockUseUpdateProgramSessionsForward,
  updateMutate,
  updateForwardMutate,
  deleteMutate,
  reorderMutate,
  duplicateSessionMutate,
  saveMutate,
} = vi.hoisted(() => ({
  mockUseProgram: vi.fn(),
  mockUseSaveProgramSession: vi.fn(),
  mockUseUpdateProgramSession: vi.fn(),
  mockUseDeleteProgramSession: vi.fn(),
  mockUseDuplicateProgramSession: vi.fn(),
  mockUseDuplicateProgramWeek: vi.fn(),
  mockUseReorderProgramSessions: vi.fn(),
  mockUseUpdateProgramSessionsForward: vi.fn(),
  updateMutate: vi.fn(),
  updateForwardMutate: vi.fn(),
  deleteMutate: vi.fn(),
  reorderMutate: vi.fn(),
  duplicateSessionMutate: vi.fn(),
  saveMutate: vi.fn(),
}));

let mockUserId: string | undefined = 'owner-1';

vi.mock('~/api', () => ({
  useProgram: mockUseProgram,
  useSaveProgramSession: mockUseSaveProgramSession,
  useUpdateProgramSession: mockUseUpdateProgramSession,
  useDeleteProgramSession: mockUseDeleteProgramSession,
  useDuplicateProgramSession: mockUseDuplicateProgramSession,
  useDuplicateProgramWeek: mockUseDuplicateProgramWeek,
  useReorderProgramSessions: mockUseReorderProgramSessions,
  useUpdateProgramSessionsForward: mockUseUpdateProgramSessionsForward,
}));

vi.mock('~/contexts', async () => {
  const actual =
    await vi.importActual<typeof import('~/contexts')>('~/contexts');
  return {
    ...actual,
    useSession: () => (mockUserId ? { user: { id: mockUserId } } : null),
    useToast: () => ({ showToast: vi.fn() }),
  };
});

// Stub the heavy builder: expose the save-mode wiring so the wrapper's edit
// logic can be exercised without mounting the real StartWorkoutPage.
vi.mock('../StartWorkoutPage', () => ({
  StartWorkoutPage: ({
    programSaveMode,
  }: {
    programSaveMode?: {
      onSave: (options: unknown, title: string) => void;
      initialSession?: { title: string };
      beforeBuilder?: React.ReactNode;
    };
  }) => (
    <div>
      <div data-testid="initial-title">
        {programSaveMode?.initialSession?.title ?? 'none'}
      </div>
      {programSaveMode?.beforeBuilder}
      <button
        type="button"
        onClick={() => programSaveMode?.onSave({ opt: true }, 'Edited title')}
      >
        stub-save
      </button>
    </div>
  ),
}));

const session = {
  id: 's-1',
  programId: 'p-1',
  sequenceIndex: 0,
  weekNumber: 1,
  dayNumber: 1,
  title: 'Ladders 1-2-3',
  notes: null,
  workoutOptions: {
    complexSet: false,
    intervalTimer: 0,
    restTimer: 0,
    title: null,
    preWorkoutNotes: null,
    workoutGoal: 20,
    workoutGoalUnits: 'minutes',
    sharedWeightOneValue: 24,
    sharedWeightOneUnit: 'kilograms',
    sharedWeightTwoValue: null,
    sharedWeightTwoUnit: null,
    movements: [],
  },
};

const ownedProgram = {
  id: 'p-1',
  ownerId: 'owner-1',
  sourceProgramId: null,
  slug: null,
  title: 'My Program',
  description: null,
  authorName: null,
  numWeeks: 1,
  daysPerWeek: 3,
  isPublic: false,
  createdAt: '',
  archivedAt: null,
};

const idleMutation = () => ({ mutate: vi.fn(), isPending: false });

/** Per-session actions live behind the row's ⋯ menu: open it, then pick. */
const openSessionMenu = (title: string) => {
  fireEvent.keyDown(
    screen.getByRole('button', { name: `More actions for ${title}` }),
    { key: 'Enter' },
  );
};

/** Menu selections are deferred a tick so a dialog can mount after the close. */
const clickMenuItem = async (name: string) => {
  fireEvent.click(screen.getByRole('menuitem', { name }));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/programs/:id/sessions/new"
          element={<ProgramSessionBuilderPage />}
        />
        <Route
          path="/programs/:id/sessions/:sessionId/edit"
          element={<ProgramSessionBuilderPage />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('ProgramSessionBuilderPage', () => {
  beforeEach(() => {
    mockUserId = 'owner-1';
    updateMutate.mockReset();
    deleteMutate.mockReset();
    reorderMutate.mockReset();
    duplicateSessionMutate.mockReset();
    saveMutate.mockReset();
    mockUseProgram.mockReturnValue({
      data: { program: ownedProgram, sessions: [session] },
      isLoading: false,
      isError: false,
    });
    mockUseSaveProgramSession.mockReturnValue({
      mutate: saveMutate,
      isPending: false,
    });
    mockUseUpdateProgramSession.mockReturnValue({
      mutate: updateMutate,
      isPending: false,
    });
    mockUseDeleteProgramSession.mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    });
    mockUseDuplicateProgramSession.mockReturnValue({
      mutate: duplicateSessionMutate,
      isPending: false,
    });
    mockUseDuplicateProgramWeek.mockReturnValue(idleMutation());
    mockUseReorderProgramSessions.mockReturnValue({
      mutate: reorderMutate,
      isPending: false,
    });
    updateForwardMutate.mockReset();
    mockUseUpdateProgramSessionsForward.mockReturnValue({
      mutate: updateForwardMutate,
      isPending: false,
    });
  });

  it('rests on the session list and reveals the builder on demand', () => {
    renderAt('/programs/p-1/sessions/new');

    expect(
      screen.queryByRole('button', { name: 'stub-save' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add session' }));

    expect(
      screen.getByRole('button', { name: 'stub-save' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Saved sessions (1)')).not.toBeInTheDocument();
  });

  it('returns to the list from the open builder', () => {
    renderAt('/programs/p-1/sessions/new');

    fireEvent.click(screen.getByRole('button', { name: 'Add session' }));
    fireEvent.click(screen.getByRole('button', { name: '← Sessions' }));

    expect(screen.getByText('Saved sessions (1)')).toBeInTheDocument();
  });

  it('saves a new session from the revealed builder', () => {
    renderAt('/programs/p-1/sessions/new');

    fireEvent.click(screen.getByRole('button', { name: 'Add session' }));
    fireEvent.click(screen.getByRole('button', { name: 'stub-save' }));

    expect(saveMutate).toHaveBeenCalledWith(
      {
        programId: 'p-1',
        sequenceIndex: 1,
        weekNumber: 1,
        dayNumber: 2,
        title: 'Edited title',
        workoutOptions: { opt: true },
      },
      expect.anything(),
    );
  });

  it('opens straight into the builder for a program with no sessions', () => {
    mockUseProgram.mockReturnValue({
      data: { program: ownedProgram, sessions: [] },
      isLoading: false,
      isError: false,
    });

    renderAt('/programs/p-1/sessions/new');

    expect(
      screen.getByRole('button', { name: 'stub-save' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add session' }),
    ).not.toBeInTheDocument();
  });

  it('offers an Edit control per session in add mode', async () => {
    renderAt('/programs/p-1/sessions/new');

    openSessionMenu('Ladders 1-2-3');

    expect(
      screen.getByRole('menuitem', { name: 'Edit session' }),
    ).toBeInTheDocument();
  });

  it('duplicates a session from the row menu', async () => {
    renderAt('/programs/p-1/sessions/new');

    openSessionMenu('Ladders 1-2-3');
    await clickMenuItem('Duplicate session');

    expect(duplicateSessionMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({ id: 's-1' }),
      }),
    );
  });

  it('confirms in a dialog before deleting a session', async () => {
    renderAt('/programs/p-1/sessions/new');

    openSessionMenu('Ladders 1-2-3');
    await clickMenuItem('Delete session');

    expect(deleteMutate).not.toHaveBeenCalled();
    expect(screen.getByText('Delete this session?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));

    expect(deleteMutate).toHaveBeenCalledWith(
      { sessionId: 's-1', programId: 'p-1' },
      expect.anything(),
    );
  });

  it('keeps the session when the confirm dialog is dismissed', async () => {
    renderAt('/programs/p-1/sessions/new');

    openSessionMenu('Ladders 1-2-3');
    await clickMenuItem('Delete session');
    fireEvent.click(screen.getByRole('button', { name: 'Keep session' }));

    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it('duplicates a whole week', () => {
    renderAt('/programs/p-1/sessions/new');

    expect(
      screen.getByRole('button', { name: 'Duplicate week' }),
    ).toBeInTheDocument();
  });

  it('leaves a non-owner with Duplicate only', async () => {
    mockUserId = 'someone-else';
    renderAt('/programs/p-1/sessions/new');

    openSessionMenu('Ladders 1-2-3');

    expect(
      screen.getByRole('menuitem', { name: 'Duplicate session' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Edit session' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitem', { name: 'Delete session' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Move / }),
    ).not.toBeInTheDocument();
  });

  it('seeds the builder from the target session and updates it in place on save', () => {
    renderAt('/programs/p-1/sessions/s-1/edit');

    // The builder is pre-loaded with the edited session's title.
    expect(screen.getByTestId('initial-title')).toHaveTextContent(
      'Ladders 1-2-3',
    );

    fireEvent.click(screen.getByRole('button', { name: 'stub-save' }));

    expect(updateMutate).toHaveBeenCalledWith(
      {
        sessionId: 's-1',
        programId: 'p-1',
        title: 'Edited title',
        workoutOptions: { opt: true },
      },
      expect.anything(),
    );
  });

  describe('with later sessions in the program', () => {
    const laterSession = {
      ...session,
      id: 's-2',
      sequenceIndex: 1,
      dayNumber: 2,
      title: 'Ladders 1-2-3-4',
    };

    beforeEach(() => {
      mockUseProgram.mockReturnValue({
        data: { program: ownedProgram, sessions: [session, laterSession] },
        isLoading: false,
        isError: false,
      });
    });

    it('reorders both directions from the row arrows', () => {
      renderAt('/programs/p-1/sessions/new');

      fireEvent.click(
        screen.getByRole('button', { name: 'Move Ladders 1-2-3 down' }),
      );
      expect(reorderMutate).toHaveBeenCalledWith({
        programId: 'p-1',
        orderedIds: ['s-2', 's-1'],
      });

      reorderMutate.mockReset();
      fireEvent.click(
        screen.getByRole('button', { name: 'Move Ladders 1-2-3-4 up' }),
      );
      expect(reorderMutate).toHaveBeenCalledWith({
        programId: 'p-1',
        orderedIds: ['s-2', 's-1'],
      });
    });

    it('asks whether to apply the edit forward instead of saving directly', () => {
      renderAt('/programs/p-1/sessions/s-1/edit');

      fireEvent.click(screen.getByRole('button', { name: 'stub-save' }));

      expect(updateMutate).not.toHaveBeenCalled();
      expect(screen.getByText('Apply changes to…')).toBeInTheDocument();
    });

    it('saves only the edited session when "This session only" is chosen', () => {
      renderAt('/programs/p-1/sessions/s-1/edit');

      fireEvent.click(screen.getByRole('button', { name: 'stub-save' }));
      fireEvent.click(
        screen.getByRole('button', { name: 'This session only' }),
      );

      expect(updateForwardMutate).not.toHaveBeenCalled();
      expect(updateMutate).toHaveBeenCalledWith(
        {
          sessionId: 's-1',
          programId: 'p-1',
          title: 'Edited title',
          workoutOptions: { opt: true },
        },
        expect.anything(),
      );
    });

    it('applies forward when "This and all future sessions" is chosen', () => {
      renderAt('/programs/p-1/sessions/s-1/edit');

      fireEvent.click(screen.getByRole('button', { name: 'stub-save' }));
      fireEvent.click(
        screen.getByRole('button', { name: 'This and all future sessions' }),
      );

      expect(updateMutate).not.toHaveBeenCalled();
      expect(updateForwardMutate).toHaveBeenCalledWith(
        {
          sessionId: 's-1',
          programId: 'p-1',
          title: 'Edited title',
          workoutOptions: { opt: true },
        },
        expect.anything(),
      );
    });

    it('saves the last session directly without asking', () => {
      renderAt('/programs/p-1/sessions/s-2/edit');

      fireEvent.click(screen.getByRole('button', { name: 'stub-save' }));

      expect(screen.queryByText('Apply changes to…')).not.toBeInTheDocument();
      expect(updateMutate).toHaveBeenCalled();
      expect(updateForwardMutate).not.toHaveBeenCalled();
    });
  });

  it('blocks editing a session that does not exist', () => {
    renderAt('/programs/p-1/sessions/missing/edit');

    expect(screen.getByText('Session not found.')).toBeInTheDocument();
  });
});
