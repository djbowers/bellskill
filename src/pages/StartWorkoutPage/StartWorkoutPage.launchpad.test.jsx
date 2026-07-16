import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { QueryClient, QueryClientProvider } from 'react-query';
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

// The launchpad shell (PROD-171) is the master gate. These tests exercise the
// gate itself and the exposure logging, so both the flag hook and trackEvent are
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

describe('StartWorkoutPage — launchpad shell master gate', () => {
  describe('shell OFF (control)', () => {
    test('drops a returning user straight into the pure builder', async () => {
      setFlags(); // all off — true control baseline
      renderPage();

      // Pure builder: the movement input is present with no browse surface and
      // no escape-hatch button (that only exists inside the shell).
      expect(
        await screen.findByLabelText('Movement Input'),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /build custom workout/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('Pick up where you left off'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Two-Hand Swing' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('shell ON — content routed by the master flag alone', () => {
    test('a new user sees curated first-workout content (no sub-flags needed)', async () => {
      returnZeroWorkoutLogs();
      setFlags({ launchpadShell: true });
      renderPage();

      expect(
        await screen.findByRole('button', { name: 'Two-Hand Swing' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Your recommended first workout' }),
      ).toBeInTheDocument();
      // New-user shell is curated, not repeat-previous.
      expect(
        screen.queryByText('Pick up where you left off'),
      ).not.toBeInTheDocument();
    });

    test('a returning user sees repeat-previous content (no sub-flags needed)', async () => {
      setFlags({ launchpadShell: true });
      renderPage();

      expect(
        await screen.findByText('Pick up where you left off'),
      ).toBeInTheDocument();
      // Returning-user shell is repeat-previous, not curated.
      expect(
        screen.queryByRole('heading', { name: 'Recommended sessions' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('exposure logging (joinable to the PROD-170 funnel by user_id)', () => {
    test('logs the treatment exposure for a new user in the shell', async () => {
      returnZeroWorkoutLogs();
      setFlags({ launchpadShell: true });
      renderPage();

      await waitFor(() =>
        expect(mockTrackEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'launchpad_exposed',
            userId: 'user-123',
            properties: expect.objectContaining({
              shell_variant: 'on',
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

    test('logs the control exposure (pure builder) for a returning user', async () => {
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
              content: ['builder'],
            }),
          }),
        ),
      );
    });
  });
});
