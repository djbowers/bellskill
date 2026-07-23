import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { DEFAULT_WORKOUT_OPTIONS, WorkoutOptionsContext } from '~/contexts';

import { StartWorkoutPage } from './StartWorkoutPage';

// Home offers one program at a time even when several are running in parallel:
// the least-recently-worked one (index 0, already sorted by `useActivePrograms`),
// with a switcher to reach the others. The switcher is absent for a single
// program, so the one-program surface is unchanged.
const { mockUseActivePrograms, mockUseFeatures, mockSkipMutate } = vi.hoisted(
  () => ({
    mockUseActivePrograms: vi.fn(),
    mockUseFeatures: vi.fn(),
    mockSkipMutate: vi.fn(),
  }),
);
vi.mock('~/api', async (importOriginal) => ({
  ...(await importOriginal()),
  useActivePrograms: mockUseActivePrograms,
  useCompleteProgramSession: () => ({
    mutate: mockSkipMutate,
    isPending: false,
  }),
}));
vi.mock('~/hooks', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeatures: mockUseFeatures,
}));

const BASE_FEATURES = {
  bottomNav: false,
  complexMode: false,
  explore: false,
  premium: false,
  programs: true,
  weeklyBalance: false,
};

const activeProgram = (id, title, sessionTitle) => ({
  enrollment: { id, programId: `${id}-program`, status: 'active' },
  program: { id: `${id}-program`, title },
  nextSession: {
    session: {
      id: `${id}-ps-0`,
      sequenceIndex: 0,
      weekNumber: 1,
      dayNumber: 1,
      title: sessionTitle,
      workoutOptions: DEFAULT_WORKOUT_OPTIONS,
    },
    workoutOptions: DEFAULT_WORKOUT_OPTIONS,
  },
  progress: { completed: 0, total: 3, week: 1, day: 1 },
  isComplete: false,
  lastWorkedAt: null,
});

const renderPage = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={['/']}>
        <WorkoutOptionsContext.Provider
          value={[DEFAULT_WORKOUT_OPTIONS, vi.fn()]}
        >
          <StartWorkoutPage />
        </WorkoutOptionsContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('StartWorkoutPage parallel programs', () => {
  beforeEach(() => {
    mockUseFeatures.mockReturnValue(BASE_FEATURES);
    mockSkipMutate.mockClear();
  });

  test('renders no switcher for a single active program', () => {
    mockUseActivePrograms.mockReturnValue({
      data: [activeProgram('up-1', 'Dry Fighting Weight', 'Ladders 1-2-3')],
      isError: false,
    });

    renderPage();

    expect(screen.getByText('Dry Fighting Weight')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  test('offers the first program by default and switches the card on demand', () => {
    mockUseActivePrograms.mockReturnValue({
      data: [
        activeProgram('up-1', 'Easy Strength', 'Day 1'),
        activeProgram('up-2', 'Dry Fighting Weight', 'Ladders 1-2-3'),
      ],
      isError: false,
    });

    renderPage();

    // Index 0 is the least-recently-worked program.
    expect(screen.getByText('Day 1')).toBeInTheDocument();
    expect(screen.queryByText('Ladders 1-2-3')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('tab', { name: /Dry Fighting Weight/ }),
    );

    expect(screen.getByText('Ladders 1-2-3')).toBeInTheDocument();
    expect(screen.queryByText('Day 1')).not.toBeInTheDocument();
  });

  test('skips the selected program, not the default one', () => {
    mockUseActivePrograms.mockReturnValue({
      data: [
        activeProgram('up-1', 'Easy Strength', 'Day 1'),
        activeProgram('up-2', 'Dry Fighting Weight', 'Ladders 1-2-3'),
      ],
      isError: false,
    });

    renderPage();

    fireEvent.click(
      screen.getByRole('tab', { name: /Dry Fighting Weight/ }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(mockSkipMutate).toHaveBeenCalledWith({
      userProgramId: 'up-2',
      programSessionId: 'up-2-ps-0',
      status: 'skipped',
    });
  });
});
