import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { DEFAULT_WORKOUT_OPTIONS, WorkoutOptionsContext } from '~/contexts';

import { StartWorkoutPage } from './StartWorkoutPage';

// The un-enrolled home offers a quiet "Start a program" card into the catalog,
// in the same slot BuildCustomCard occupies for enrolled users. It only exists
// when the programs feature is on and the user has no active program.
const { mockUseActivePrograms, mockUseFeatures } = vi.hoisted(() => ({
  mockUseActivePrograms: vi.fn(),
  mockUseFeatures: vi.fn(),
}));
vi.mock('~/api', async (importOriginal) => ({
  ...(await importOriginal()),
  useActivePrograms: mockUseActivePrograms,
}));
vi.mock('~/hooks', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeatures: mockUseFeatures,
}));

const BASE_FEATURES = {
  explore: false,
  modalityBalance: false,
  premium: false,
  programs: true,
  weeklyBalance: false,
};

const activeProgram = {
  enrollment: { id: 'up-1', programId: 'p-1', status: 'active' },
  program: { id: 'p-1', title: 'Dry Fighting Weight' },
  nextSession: {
    session: {
      id: 'ps-0',
      sequenceIndex: 0,
      weekNumber: 1,
      dayNumber: 1,
      title: 'Ladders 1-2-3',
      workoutOptions: DEFAULT_WORKOUT_OPTIONS,
    },
    workoutOptions: DEFAULT_WORKOUT_OPTIONS,
  },
  progress: { completed: 0, total: 3, week: 1, day: 1 },
  isComplete: false,
  lastWorkedAt: null,
};

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

describe('StartWorkoutPage — Start a program card', () => {
  beforeEach(() => {
    mockUseFeatures.mockReturnValue(BASE_FEATURES);
  });

  test('shows the card linking to /programs when un-enrolled', () => {
    mockUseActivePrograms.mockReturnValue({ data: [], isError: false });

    renderPage();

    const link = screen.getByRole('link', { name: /start a program/i });
    expect(link).toHaveAttribute('href', '/programs');
  });

  test('hides the card when a program is active', () => {
    mockUseActivePrograms.mockReturnValue({
      data: [activeProgram],
      isError: false,
    });

    renderPage();

    expect(
      screen.queryByRole('link', { name: /start a program/i }),
    ).not.toBeInTheDocument();
  });

  test('hides the card when the programs feature is off', () => {
    mockUseFeatures.mockReturnValue({ ...BASE_FEATURES, programs: false });
    mockUseActivePrograms.mockReturnValue({ data: [], isError: false });

    renderPage();

    expect(
      screen.queryByRole('link', { name: /start a program/i }),
    ).not.toBeInTheDocument();
  });
});
