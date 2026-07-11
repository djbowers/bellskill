import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';

import { DEFAULT_WORKOUT_OPTIONS, WorkoutOptionsContext } from '~/contexts';

import { StartWorkoutPage } from './StartWorkoutPage';

// Regression coverage for the browse-flash fix: `StartWorkoutPage` used to
// commit to a mode (browse vs builder) from a still-forced `showBrowse` at
// mount, then self-correct once the (async) program/feature-flag gates
// settled — a visible flash in both directions. It now withholds rendering
// entirely until both gates resolve.
const { mockUseFeatureFlags } = vi.hoisted(() => ({
  mockUseFeatureFlags: vi.fn(),
}));
vi.mock('~/api', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeatureFlags: mockUseFeatureFlags,
}));

const SAFE_DEFAULT_FEATURES = {
  curatedFirstWorkout: false,
  repeatPrevious: false,
  recommender: false,
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

describe('StartWorkoutPage pending-gate skeleton', () => {
  test('renders a loading state — neither browse nor builder — while flags are still resolving', () => {
    mockUseFeatureFlags.mockReturnValue({
      features: SAFE_DEFAULT_FEATURES,
      isPending: true,
    });

    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByLabelText('Movement Input')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /build custom workout/i }),
    ).not.toBeInTheDocument();
  });

  test('lands directly on browse once flags settle to treatment — no builder flash first', () => {
    mockUseFeatureFlags.mockReturnValue({
      features: { ...SAFE_DEFAULT_FEATURES, curatedFirstWorkout: true },
      isPending: false,
    });

    renderPage();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Movement Input')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /build custom workout/i }),
    ).toBeInTheDocument();
  });

  test('lands directly on the builder once flags settle to control — no browse flash first', () => {
    mockUseFeatureFlags.mockReturnValue({
      features: SAFE_DEFAULT_FEATURES,
      isPending: false,
    });

    renderPage();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Movement Input')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /build custom workout/i }),
    ).not.toBeInTheDocument();
  });

  test('editWorkout (history "Repeat") bypasses the skeleton even while flags are still pending', () => {
    mockUseFeatureFlags.mockReturnValue({
      features: SAFE_DEFAULT_FEATURES,
      isPending: true,
    });

    renderPage({ editWorkout: true });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Movement Input')).toBeInTheDocument();
  });
});
