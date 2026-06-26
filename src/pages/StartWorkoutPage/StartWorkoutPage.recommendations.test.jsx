import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { CURATED_WORKOUTS } from '~/constants';
import {
  DEFAULT_WORKOUT_OPTIONS,
  EntitlementContext,
  WorkoutOptionsContext,
} from '~/contexts';
import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { StartWorkoutPage } from './StartWorkoutPage';

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

const renderPage = (updateWorkoutOptions = vi.fn()) => {
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={['/']}>
        <EntitlementContext.Provider value={freeEntitlement}>
          <WorkoutOptionsContext.Provider
            value={[DEFAULT_WORKOUT_OPTIONS, updateWorkoutOptions]}
          >
            <Routes>
              <Route path="/" element={<StartWorkoutPage />} />
              <Route path="/active" element={<div>active workout page</div>} />
            </Routes>
          </WorkoutOptionsContext.Provider>
        </EntitlementContext.Provider>
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

      // Builder is collapsed until a card or "Build custom workout" is tapped.
      expect(screen.queryByLabelText('Movement Input')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /start workout/i }),
      ).not.toBeInTheDocument();
    });

    test('"Build custom workout" reveals an empty builder and hides recommendations', async () => {
      renderPage();

      await userEvent.click(
        await screen.findByRole('button', {
          name: /build custom workout/i,
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
        startedAt,
      });
      expect(screen.getByText('active workout page')).toBeInTheDocument();
    });
  });

  describe('returning user (has history)', () => {
    test('shows recent repeats alongside the curated workouts', async () => {
      renderPage();

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
});
