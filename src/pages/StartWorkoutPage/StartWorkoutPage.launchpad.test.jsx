import { render, screen, waitFor } from '@testing-library/react';
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

// The launchpad shell graduated to baseline: the hub always renders, and the
// discovery content sits behind its own flags. These tests exercise that content
// gating and the exposure logging, so both the flag hook and trackEvent are
// mocked: the flag hook is driven per-test, and trackEvent is a spy asserting the
// launchpad_exposed event's variant / population / content payload.
const { mockUseFeatureFlags, mockTrackEvent } = vi.hoisted(() => ({
  mockUseFeatureFlags: vi.fn(),
  mockTrackEvent: vi.fn(),
}));

vi.mock('~/api', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeatureFlags: mockUseFeatureFlags,
  trackEvent: mockTrackEvent,
}));

const ALL_OFF = {
  launchpadShell: false,
  curatedFirstWorkout: false,
  repeatPrevious: false,
  recommender: false,
};

const setFlags = (overrides = {}) =>
  mockUseFeatureFlags.mockReturnValue({
    features: { ...ALL_OFF, ...overrides },
    isPending: false,
  });

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

const renderPage = () =>
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={['/']}>
        <SessionProvider value={mockSession}>
          <EntitlementContext.Provider value={freeEntitlement}>
            <WorkoutOptionsContext.Provider
              value={[DEFAULT_WORKOUT_OPTIONS, vi.fn()]}
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

// Default MSW returns a user with history (returning); override for a new user.
const returnZeroWorkoutLogs = () =>
  server.use(
    http.get(`${VITE_SUPABASE_URL}/rest/v1/workout_logs`, () =>
      HttpResponse.json([]),
    ),
  );

beforeEach(() => {
  mockTrackEvent.mockClear();
});

describe('StartWorkoutPage — hub baseline and content gating', () => {
  describe('all discovery flags off', () => {
    test('a returning user still lands on the hub, with no discovery content', async () => {
      setFlags(); // all off
      renderPage();

      // The hub renders regardless of flags — not the raw builder.
      expect(await screen.findByText('Start a workout')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /build a workout/i }),
      ).toBeInTheDocument();
      // The builder is a secondary state, not mounted yet.
      expect(
        screen.queryByLabelText('Movement Input'),
      ).not.toBeInTheDocument();
      // No gated discovery content.
      expect(
        screen.queryByText('Pick up where you left off'),
      ).not.toBeInTheDocument();
    });
  });

  describe('content gated by its own flag', () => {
    test('curatedFirstWorkout on → a new user sees curated first-workout content', async () => {
      returnZeroWorkoutLogs();
      setFlags({ curatedFirstWorkout: true });
      renderPage();

      expect(
        await screen.findByRole('button', { name: 'Two-Hand Swing' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Your recommended first workout' }),
      ).toBeInTheDocument();
      // New-user content is curated, not repeat-previous.
      expect(
        screen.queryByText('Pick up where you left off'),
      ).not.toBeInTheDocument();
    });

    test('repeatPrevious on → a returning user sees repeat-previous content', async () => {
      setFlags({ repeatPrevious: true });
      renderPage();

      expect(
        await screen.findByText('Pick up where you left off'),
      ).toBeInTheDocument();
      // Returning-user content is repeat-previous, not curated.
      expect(
        screen.queryByRole('heading', { name: 'Recommended sessions' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('exposure logging (joinable to the PROD-170 funnel by user_id)', () => {
    test('logs curated content for a new user with the flag on', async () => {
      returnZeroWorkoutLogs();
      setFlags({ curatedFirstWorkout: true });
      renderPage();

      await waitFor(() =>
        expect(mockTrackEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'launchpad_exposed',
            userId: 'user-123',
            properties: expect.objectContaining({
              population: 'new',
              content: expect.arrayContaining([
                'curated_first',
                'build_custom',
              ]),
            }),
          }),
        ),
      );
    });

    test('logs the bare hub for a returning user with all flags off', async () => {
      setFlags(); // all off
      renderPage();

      await waitFor(() =>
        expect(mockTrackEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'launchpad_exposed',
            userId: 'user-123',
            properties: expect.objectContaining({
              shell_variant: 'off',
              population: 'returning',
              content: ['build_custom'],
            }),
          }),
        ),
      );
    });
  });
});
