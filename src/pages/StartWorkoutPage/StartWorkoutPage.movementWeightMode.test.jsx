import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import {
  DEFAULT_WORKOUT_OPTIONS,
  EntitlementContext,
  SessionProvider,
  WorkoutOptionsContext,
} from '~/contexts';
import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { StartWorkoutPage } from './StartWorkoutPage';

const { mockUseFeatureFlags } = vi.hoisted(() => ({
  mockUseFeatureFlags: vi.fn(),
}));
vi.mock('~/api', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeatureFlags: mockUseFeatureFlags,
}));
mockUseFeatureFlags.mockReturnValue({
  features: {
    launchpadShell: false,
    curatedFirstWorkout: false,
    repeatPrevious: false,
    recommender: false,
  },
  isPending: false,
});

const freeEntitlement = {
  isPremium: false,
  isTrialing: false,
  trialExpired: false,
  trialDaysRemaining: null,
  effectiveAccess: 'free',
  isLoading: false,
  refetch: () => {},
};

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

const catalogRow = (id, name, itemCount, arm) => ({
  id,
  Movement: name,
  'Primary Equipment': 'Kettlebell',
  '# Primary Items': itemCount,
  'Single or Double Arm': arm,
  'Target Muscle Group': 'Hamstrings',
  'Difficulty Level': 'Beginner',
  'Movement Pattern #1': 'Hip Hinge',
  'Pattern Credits': 'hinge',
});

const CATALOG = [
  catalogRow('mov-2h', 'Kettlebell Swing', 1, 'Double Arm'),
  catalogRow('mov-1h', 'One-Arm Kettlebell Swing', 1, 'Single Arm'),
  catalogRow('mov-dbl', 'Double Kettlebell Swing', 2, 'Double Arm'),
];

const renderPage = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter>
        <SessionProvider value={mockSession}>
          <EntitlementContext.Provider value={freeEntitlement}>
            <WorkoutOptionsContext.Provider
              value={[DEFAULT_WORKOUT_OPTIONS, vi.fn()]}
            >
              <StartWorkoutPage />
            </WorkoutOptionsContext.Provider>
          </EntitlementContext.Provider>
        </SessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

// The hub is the default surface; the builder is behind "Build a workout".
const enterBuildMode = async () => {
  await userEvent.click(
    await screen.findByRole('button', { name: /build a workout/i }),
  );
  return screen.getByLabelText('Movement Input');
};

const tab = (name) => screen.getByRole('tab', { name });
// A catalog-linked movement reads its mode out as a chip; only a custom one
// still gets the tablist.
const readOutMode = () =>
  screen.queryByRole('tab', { name: 'Bodyweight' })
    ? null
    : screen.getByText(/^(Bodyweight|Two-Hand|Single|Double)$/).textContent;

describe('builder weight mode follows the picked movement', () => {
  beforeEach(() => {
    server.use(
      http.get(`${VITE_SUPABASE_URL}/rest/v1/movements`, () =>
        HttpResponse.json(CATALOG),
      ),
    );
  });

  test('a two-hand movement selects Two-Hand and locks the tabs', async () => {
    renderPage();

    await userEvent.type(await enterBuildMode(), 'Kettlebell Swing');

    await waitFor(() => expect(readOutMode()).toBe('Two-Hand'));
  });

  test('a single-arm movement selects Single', async () => {
    renderPage();

    await userEvent.type(await enterBuildMode(), 'One-Arm Kettlebell Swing');

    await waitFor(() => expect(readOutMode()).toBe('Single'));
  });

  test('a double movement selects Double and mirrors the load', async () => {
    renderPage();

    await userEvent.type(await enterBuildMode(), 'Double Kettlebell Swing');

    await waitFor(() => expect(readOutMode()).toBe('Double'));
    expect(screen.getAllByRole('button', { name: '+ kg' })).toHaveLength(2);
    expect(screen.getAllByDisplayValue('16')).toHaveLength(2);
  });

  test('a movement the catalog does not know leaves the tabs editable', async () => {
    renderPage();

    await userEvent.type(await enterBuildMode(), 'My Homemade Carry');

    expect(tab('Single')).toBeEnabled();

    await userEvent.click(tab('Single'));
    expect(tab('Single')).toHaveAttribute('data-state', 'active');
  });

  test('carries the load already dialled in over into the derived mode', async () => {
    renderPage();

    const input = await enterBuildMode();
    await userEvent.type(input, 'My Homemade Carry');
    await userEvent.click(screen.getByRole('button', { name: '+ kg' }));
    expect(screen.getAllByDisplayValue('17')).toHaveLength(1);

    await userEvent.clear(input);
    await userEvent.type(input, 'Double Kettlebell Swing');

    await waitFor(() => expect(readOutMode()).toBe('Double'));
    expect(screen.getAllByDisplayValue('17')).toHaveLength(2);
  });
});
