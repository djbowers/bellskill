import { Meta } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import {
  DEFAULT_WORKOUT_OPTIONS,
  EntitlementContext,
  EntitlementContextValue,
  SessionProvider,
  WorkoutOptionsContext,
} from '~/contexts';

import { StartWorkoutPage } from './StartWorkoutPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

// The recommender surface (on in test/dev) reads EntitlementContext; default to
// a free user so the page renders without a wrapping EntitlementProvider.
const freeEntitlement: EntitlementContextValue = {
  isPremium: false,
  isTrialing: false,
  trialExpired: false,
  trialDaysRemaining: null,
  effectiveAccess: 'free',
  isLoading: false,
  refetch: () => {},
};

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

export default {
  component: StartWorkoutPage,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
    (Story, { parameters }) => (
      <QueryClientProvider client={queryClient}>
        <SessionProvider value={parameters.session ?? mockSession}>
          <EntitlementContext.Provider
            value={parameters.entitlement || freeEntitlement}
          >
            <WorkoutOptionsContext.Provider
              value={[
                parameters.workoutOptions || DEFAULT_WORKOUT_OPTIONS,
                parameters.updateWorkoutOptions,
              ]}
            >
              <Story />
            </WorkoutOptionsContext.Provider>
          </EntitlementContext.Provider>
        </SessionProvider>
      </QueryClientProvider>
    ),
  ],
} as Meta;

export const Default = {};

export const WithoutPreviousVolume = {
  parameters: {
    workoutOptions: {
      ...DEFAULT_WORKOUT_OPTIONS,
      previousVolume: undefined,
    },
  },
};
