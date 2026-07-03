import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { WorkoutOptionsContext } from '~/contexts';
import { workoutLogs } from '~/mocks/data';

import { CompletedWorkoutPage } from './CompletedWorkoutPage';

export default {
  component: CompletedWorkoutPage,
  decorators: [
    (Story, { parameters }) => (
      <MemoryRouter
        initialEntries={[
          {
            pathname: `/history/${workoutLogs[0].id}`,
            state: parameters.routerState ?? null,
          },
        ]}
      >
        <Routes>
          <Route path="/history/:id" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
    (Story, { parameters }) => (
      <WorkoutOptionsContext.Provider
        value={[{}, parameters.updateWorkoutOptions]}
      >
        <Story />
      </WorkoutOptionsContext.Provider>
    ),
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <Story />
      </QueryClientProvider>
    ),
  ],
};

export const Default = {};

export const JustFinished = {
  parameters: {
    routerState: { justFinished: true },
  },
};
