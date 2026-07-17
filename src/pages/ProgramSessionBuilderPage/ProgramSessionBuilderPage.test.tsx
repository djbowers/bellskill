import { fireEvent, render, screen } from '@testing-library/react';
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
  updateMutate,
} = vi.hoisted(() => ({
  mockUseProgram: vi.fn(),
  mockUseSaveProgramSession: vi.fn(),
  mockUseUpdateProgramSession: vi.fn(),
  mockUseDeleteProgramSession: vi.fn(),
  mockUseDuplicateProgramSession: vi.fn(),
  mockUseDuplicateProgramWeek: vi.fn(),
  mockUseReorderProgramSessions: vi.fn(),
  updateMutate: vi.fn(),
}));

vi.mock('~/api', () => ({
  useProgram: mockUseProgram,
  useSaveProgramSession: mockUseSaveProgramSession,
  useUpdateProgramSession: mockUseUpdateProgramSession,
  useDeleteProgramSession: mockUseDeleteProgramSession,
  useDuplicateProgramSession: mockUseDuplicateProgramSession,
  useDuplicateProgramWeek: mockUseDuplicateProgramWeek,
  useReorderProgramSessions: mockUseReorderProgramSessions,
}));

vi.mock('~/contexts', async () => {
  const actual =
    await vi.importActual<typeof import('~/contexts')>('~/contexts');
  return {
    ...actual,
    useSession: () => ({ user: { id: 'owner-1' } }),
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
    workoutDetails: null,
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

const idleMutation = () => ({ mutate: vi.fn(), isLoading: false });

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
    updateMutate.mockReset();
    mockUseProgram.mockReturnValue({
      data: { program: ownedProgram, sessions: [session] },
      isLoading: false,
      isError: false,
    });
    mockUseSaveProgramSession.mockReturnValue(idleMutation());
    mockUseUpdateProgramSession.mockReturnValue({
      mutate: updateMutate,
      isLoading: false,
    });
    mockUseDeleteProgramSession.mockReturnValue(idleMutation());
    mockUseDuplicateProgramSession.mockReturnValue(idleMutation());
    mockUseDuplicateProgramWeek.mockReturnValue(idleMutation());
    mockUseReorderProgramSessions.mockReturnValue(idleMutation());
  });

  it('offers an Edit control per session in add mode', () => {
    renderAt('/programs/p-1/sessions/new');

    expect(
      screen.getByRole('button', { name: 'Edit Ladders 1-2-3' }),
    ).toBeInTheDocument();
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

  it('blocks editing a session that does not exist', () => {
    renderAt('/programs/p-1/sessions/missing/edit');

    expect(screen.getByText('Session not found.')).toBeInTheDocument();
  });
});
