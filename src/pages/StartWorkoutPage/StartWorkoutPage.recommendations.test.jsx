import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { CURATED_WORKOUTS } from '~/constants';
import { DEFAULT_WORKOUT_OPTIONS, WorkoutOptionsContext } from '~/contexts';
import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { StartWorkoutPage } from './StartWorkoutPage';

const startedAt = new Date('2026-06-25T12:00:00.000Z');
vi.setSystemTime(startedAt);

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const renderPage = (updateWorkoutOptions = vi.fn()) => {
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={['/']}>
        <WorkoutOptionsContext.Provider
          value={[DEFAULT_WORKOUT_OPTIONS, updateWorkoutOptions]}
        >
          <Routes>
            <Route path="/" element={<StartWorkoutPage />} />
            <Route path="/active" element={<div>active workout page</div>} />
          </Routes>
        </WorkoutOptionsContext.Provider>
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

    test('shows the curated first workouts and no recent repeats', async () => {
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
    });

    test('one-tap on a curated workout prefills context and enters the active workout', async () => {
      const { updateWorkoutOptions } = renderPage();

      await userEvent.click(
        await screen.findByRole('button', { name: 'Two-Hand Swing' }),
      );

      expect(updateWorkoutOptions).toHaveBeenCalledTimes(1);
      expect(updateWorkoutOptions).toHaveBeenCalledWith({
        ...CURATED_WORKOUTS[0].workoutOptions,
        startedAt,
      });
      expect(screen.getByText('active workout page')).toBeInTheDocument();
    });
  });

  describe('returning user (has history)', () => {
    test('shows recent repeats alongside the curated workouts', async () => {
      renderPage();

      // Both surfaces are shown for returning users ("always show both").
      expect(
        await screen.findByText('Pick up where you left off'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Recommended sessions' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Two-Hand Swing' }),
      ).toBeInTheDocument();
    });

    test('one-tap on a recent workout prefills it and enters the active workout', async () => {
      const { updateWorkoutOptions } = renderPage();

      // The most recent logged session in the mock data is a "Pull-Ups" workout.
      await userEvent.click(
        await screen.findByRole('button', { name: 'Pull-Ups' }),
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
});
