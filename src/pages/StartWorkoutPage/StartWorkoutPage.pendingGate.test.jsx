import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { DEFAULT_WORKOUT_OPTIONS, WorkoutOptionsContext } from '~/contexts';

import { StartWorkoutPage } from './StartWorkoutPage';

// Regression coverage for the browse-flash fix: `StartWorkoutPage` used to
// commit to a mode (browse vs builder) from a still-forced `showBrowse` at
// mount, then self-correct once the (async) active-program query settled — a
// visible flash. It now withholds rendering entirely until the gate resolves.
// (The equivalent feature-flags race is fixed by resolving flags once at app
// init — see `~/app/FeatureFlagsGate` — so this page has no flags-pending
// state left to gate on.)
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
  bottomNav: false,
  explore: false,
  premium: false,
  programs: true,
  weeklyBalance: false,
};

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const renderPage = (routerState = null) =>
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: '/', state: routerState }]}>
        <WorkoutOptionsContext.Provider
          value={[DEFAULT_WORKOUT_OPTIONS, vi.fn()]}
        >
          <StartWorkoutPage />
        </WorkoutOptionsContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('StartWorkoutPage program-gate skeleton', () => {
  beforeEach(() => {
    mockUseFeatures.mockReturnValue(BASE_FEATURES);
  });

  test('renders a loading state while the active-program query is still resolving', () => {
    mockUseActivePrograms.mockReturnValue({ data: undefined, isError: false });

    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByLabelText('Movement Input')).not.toBeInTheDocument();
  });

  test('lands on the quick-start hub once the program gate clears with no active program', async () => {
    mockUseActivePrograms.mockReturnValue({ data: [], isError: false });

    renderPage();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(await screen.findByText('Start a workout')).toBeInTheDocument();
    expect(screen.queryByLabelText('Movement Input')).not.toBeInTheDocument();
  });

  test('editWorkout (history "Repeat") bypasses the skeleton even while the program query is still pending', async () => {
    mockUseActivePrograms.mockReturnValue({ data: undefined, isError: false });

    renderPage({ editWorkout: true });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Movement Input')).toBeInTheDocument();
  });

  test('a terminally-errored active-program query releases the gate instead of stranding on the skeleton', async () => {
    // The query has no `placeholderData`, so a terminal error leaves `data`
    // undefined forever — without the `isError` escape the page would be
    // stuck on the blocking skeleton. It must fall through to the safe
    // default (no active program → quick-start hub).
    mockUseActivePrograms.mockReturnValue({ data: undefined, isError: true });

    renderPage();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(await screen.findByText('Start a workout')).toBeInTheDocument();
  });
});
