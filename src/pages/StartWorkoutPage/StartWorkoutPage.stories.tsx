import { Meta } from '@storybook/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';

import {
  DEFAULT_WORKOUT_OPTIONS,
  EntitlementContext,
  EntitlementContextValue,
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
