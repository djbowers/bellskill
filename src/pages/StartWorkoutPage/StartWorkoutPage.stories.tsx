import { Meta } from '@storybook/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';

import { DEFAULT_WORKOUT_OPTIONS, WorkoutOptionsContext } from '~/contexts';

import { StartWorkoutPage } from './StartWorkoutPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

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
        <WorkoutOptionsContext.Provider
          value={[
            parameters.workoutOptions || DEFAULT_WORKOUT_OPTIONS,
            parameters.updateWorkoutOptions,
          ]}
        >
          <Story />
        </WorkoutOptionsContext.Provider>
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
