import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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
// in browse mode. The content sub-flags are on too so the recommender surface
// mounts for a returning user.
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

    test('lands on the hub with no curated content and no builder yet', async () => {
      renderPage();

      expect(
        await screen.findByRole('button', { name: /build a workout/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Your recommended first workout' }),
      ).not.toBeInTheDocument();
      // Builder is collapsed until "Build a workout" is tapped.
      expect(screen.queryByLabelText('Movement Input')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /start workout/i }),
      ).not.toBeInTheDocument();
    });

    test('"Build a workout" reveals an empty builder', async () => {
      renderPage();

      await userEvent.click(
        await screen.findByRole('button', {
          name: /build a workout/i,
        }),
      );

      expect(screen.getByLabelText('Movement Input')).toHaveValue('');
    });
  });

  // Regression: the history "Repeat" action prefills context and navigates here
  // with `editWorkout` nav state; the builder must open directly on that
  // workout rather than showing the hub.
  describe('repeat from history (editWorkout nav state)', () => {
    test('opens the prefilled builder directly, not the hub', async () => {
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

      // ...and the browse view is not shown.
      expect(
        screen.queryByRole('button', { name: /build a workout/i }),
      ).not.toBeInTheDocument();
    });
  });
});
