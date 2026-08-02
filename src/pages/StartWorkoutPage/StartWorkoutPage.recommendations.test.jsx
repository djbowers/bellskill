import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { CURATED_WORKOUTS } from '~/constants';
import {
  DEFAULT_WORKOUT_OPTIONS,
  EntitlementContext,
  SessionProvider,
  WorkoutOptionsContext,
} from '~/contexts';
import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { StartWorkoutPage } from './StartWorkoutPage';

// The launchpad shell (PROD-171) is the master gate: with it on the page opens
// in browse mode, and content is routed by population — curated for new users,
// repeat-previous for returning. The content sub-flags are on too so the
// recommender surface mounts for a returning user.
const { mockUseFeatureFlags } = vi.hoisted(() => ({
  mockUseFeatureFlags: vi.fn(),
}));
vi.mock('~/api', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeatureFlags: mockUseFeatureFlags,
}));
mockUseFeatureFlags.mockReturnValue({
  features: {
    launchpadShell: true,
    curatedFirstWorkout: true,
    repeatPrevious: true,
    recommender: true,
  },
  isPending: false,
});

const startedAt = new Date('2026-06-25T12:00:00.000Z');
vi.setSystemTime(startedAt);

// The recommender surface (on in the test env) reads EntitlementContext.
const freeEntitlement = {
  isPremium: false,
  isTrialing: false,
  trialExpired: false,
  trialDaysRemaining: null,
  effectiveAccess: 'free',
  isLoading: false,
  refetch: () => {},
};

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

// App only mounts this page behind a resolved session, so the program queries
// always have a user id. Without one they stay disabled and the program gate
// never settles, leaving the page on its loading state.
const mockSession = {
  user: {
    id: 'user-123',
    app_metadata: {},
    user_metadata: {},
    created_at: '',
    aud: '',
  },
  access_token: '',
  refresh_token: '',
  expires_in: 10000,
  token_type: '',
};

const renderPage = (updateWorkoutOptions = vi.fn()) => {
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={['/']}>
        <SessionProvider value={mockSession}>
          <EntitlementContext.Provider value={freeEntitlement}>
            <WorkoutOptionsContext.Provider
              value={[DEFAULT_WORKOUT_OPTIONS, updateWorkoutOptions]}
            >
              <Routes>
                <Route path="/" element={<StartWorkoutPage />} />
                <Route
                  path="/active"
                  element={<div>active workout page</div>}
                />
              </Routes>
            </WorkoutOptionsContext.Provider>
          </EntitlementContext.Provider>
        </SessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { updateWorkoutOptions };
};

const returnZeroWorkoutLogs = () =>
  server.use(
    http.get(`${VITE_SUPABASE_URL}/rest/v1/workout_logs`, () =>
      HttpResponse.json([]),
    ),
  );

describe('StartWorkoutPage recommendations', () => {
  describe('new user (no history)', () => {
    beforeEach(returnZeroWorkoutLogs);

    test('shows the curated workouts, no recent repeats, and no builder yet', async () => {
      renderPage();

      expect(
        await screen.findByRole('button', { name: 'Two-Hand Swing' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Overhead Press' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Goblet Squat' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Your recommended first workout' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Pick up where you left off'),
      ).not.toBeInTheDocument();

      // Builder is collapsed until a card or "Build a workout" is tapped.
      expect(screen.queryByLabelText('Movement Input')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /start workout/i }),
      ).not.toBeInTheDocument();
    });

    test('"Build a workout" reveals an empty builder and hides recommendations', async () => {
      renderPage();

      await userEvent.click(
        await screen.findByRole('button', {
          name: /build a workout/i,
        }),
      );

      expect(screen.getByLabelText('Movement Input')).toHaveValue('');
      expect(
        screen.queryByRole('button', { name: 'Two-Hand Swing' }),
      ).not.toBeInTheDocument();
    });

    test('tapping a curated workout fills the builder for editing without starting', async () => {
      const { updateWorkoutOptions } = renderPage();

      await userEvent.click(
        await screen.findByRole('button', { name: 'Two-Hand Swing' }),
      );

      // Lands in the builder, prefilled with the catalog movement — not /active.
      expect(screen.getByLabelText('Movement Input')).toHaveValue(
        'Kettlebell Swing',
      );
      expect(updateWorkoutOptions).not.toHaveBeenCalled();
      expect(screen.queryByText('active workout page')).not.toBeInTheDocument();

      // The user can then start the (optionally edited) workout.
      await userEvent.click(
        screen.getByRole('button', { name: /start workout/i }),
      );

      expect(updateWorkoutOptions).toHaveBeenCalledTimes(1);
      expect(updateWorkoutOptions).toHaveBeenCalledWith({
        ...CURATED_WORKOUTS[0].workoutOptions,
        // Curated workouts predate the traversal-order flag, so the builder
        // supplies the default (rotating) order for them.
        straightSets: false,
        startedAt,
      });
      expect(screen.getByText('active workout page')).toBeInTheDocument();
    });
  });

  describe('returning user (has history)', () => {
    test('shows recent repeats and the build-custom entry, but not curated', async () => {
      renderPage();

      expect(
        await screen.findByText('Pick up where you left off'),
      ).toBeInTheDocument();
      // Curated first-workout content is routed to new users only — a returning
      // user's shell is repeat-previous + build custom (PROD-171).
      expect(
        screen.queryByRole('heading', { name: 'Recommended sessions' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Two-Hand Swing' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /build a workout/i }),
      ).toBeInTheDocument();
    });

    test('tapping a recent workout fills the builder, then starts on confirm', async () => {
      const { updateWorkoutOptions } = renderPage();

      // The most recent logged session in the mock data is a "Pull-Ups" workout.
      await userEvent.click(
        await screen.findByRole('button', { name: 'Pull-Ups' }),
      );

      expect(screen.getByLabelText('Movement Input')).toHaveValue('Pull-Ups');
      expect(updateWorkoutOptions).not.toHaveBeenCalled();

      await userEvent.click(
        screen.getByRole('button', { name: /start workout/i }),
      );

      expect(updateWorkoutOptions).toHaveBeenCalledTimes(1);
      const prefilled = updateWorkoutOptions.mock.calls[0][0];
      expect(prefilled.movements).toEqual([
        expect.objectContaining({ movementName: 'Pull-Ups' }),
      ]);
      expect(prefilled.startedAt).toEqual(startedAt);
      expect(screen.getByText('active workout page')).toBeInTheDocument();
    });
  });

  // Regression: the history "Repeat" action prefills context and navigates here
  // with `editWorkout` nav state; the builder must open directly on that
  // workout rather than showing the collapsed recommendations.
  describe('repeat from history (editWorkout nav state)', () => {
    test('opens the prefilled builder directly, not the recommendations', async () => {
      const repeated = {
        ...DEFAULT_WORKOUT_OPTIONS,
        movements: [
          {
            movementName: 'Clean and Press',
            repScheme: [3],
            weightOneUnit: 'kilograms',
            weightOneValue: 20,
            weightTwoUnit: null,
            weightTwoValue: null,
          },
        ],
        workoutDetails: 'The Giant 3.0 W1D2',
      };

      render(
        <QueryClientProvider client={makeQueryClient()}>
          <MemoryRouter
            initialEntries={[{ pathname: '/', state: { editWorkout: true } }]}
          >
            <WorkoutOptionsContext.Provider value={[repeated, vi.fn()]}>
              <Routes>
                <Route path="/" element={<StartWorkoutPage />} />
                <Route
                  path="/active"
                  element={<div>active workout page</div>}
                />
              </Routes>
            </WorkoutOptionsContext.Provider>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // Builder is open and prefilled with the repeated workout...
      expect(await screen.findByLabelText('Movement Input')).toHaveValue(
        'Clean and Press',
      );

      // ...and the recommendation browse view is not shown.
      expect(
        screen.queryByRole('button', { name: /build a workout/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Pick up where you left off'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Two-Hand Swing' }),
      ).not.toBeInTheDocument();
    });
  });
});
