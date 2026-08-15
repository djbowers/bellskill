import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import {
  DEFAULT_MOVEMENT_OPTIONS,
  DEFAULT_WORKOUT_OPTIONS,
  WorkoutOptionsContext,
} from '~/contexts';

import { StartWorkoutPage } from './StartWorkoutPage';

// Builder sections fold to a one-line summary. They open expanded when the
// user is building, and start collapsed when a program session arrives
// prefilled — the user is confirming, not building.
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

const programOptions = {
  ...DEFAULT_WORKOUT_OPTIONS,
  intervalTimer: 30,
  movements: [
    { ...DEFAULT_MOVEMENT_OPTIONS, movementName: 'Kettlebell Swing' },
  ],
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
      workoutOptions: programOptions,
    },
    workoutOptions: programOptions,
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

describe('StartWorkoutPage — collapsible builder sections', () => {
  beforeEach(() => {
    mockUseFeatures.mockReturnValue(BASE_FEATURES);
  });

  test('build-custom opens with sections expanded, and Goal collapses to a summary', () => {
    mockUseActivePrograms.mockReturnValue({ data: [], isError: false });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Build a workout' }));

    expect(screen.getByRole('tab', { name: 'Volume' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Goal' }));

    expect(screen.queryByRole('tab', { name: 'Volume' })).toBeNull();
    expect(screen.getByText('10 minutes')).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Expand Goal' })[0],
    );
    expect(screen.getByRole('tab', { name: 'Volume' })).toBeInTheDocument();
  });

  test('re-enabling a toggled-off section shows it expanded', () => {
    mockUseActivePrograms.mockReturnValue({ data: [], isError: false });

    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Build a workout' }));

    fireEvent.click(screen.getByRole('button', { name: 'Interval, off' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Collapse Interval Timer' }),
    );
    // Toggle off, then back on — it should come back expanded, not collapsed.
    fireEvent.click(screen.getByRole('button', { name: 'Interval, on' }));
    fireEvent.click(screen.getByRole('button', { name: 'Interval, off' }));

    expect(
      screen.getByRole('button', { name: 'Collapse Interval Timer' }),
    ).toBeInTheDocument();
  });

  test('starting the next program session opens everything collapsed', () => {
    mockUseActivePrograms.mockReturnValue({
      data: [activeProgram],
      isError: false,
    });

    renderPage();
    fireEvent.click(
      screen.getByRole('button', { name: 'Start next workout' }),
    );

    expect(screen.queryByRole('tab', { name: 'Volume' })).toBeNull();
    expect(screen.getByText('10 minutes')).toBeInTheDocument();
    expect(screen.getByText('30 sec')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Expand Kettlebell Swing' }),
    ).toBeInTheDocument();
  });
});
