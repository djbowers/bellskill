import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import {
  DEFAULT_MOVEMENT_OPTIONS,
  DEFAULT_WORKOUT_OPTIONS,
  SessionProvider,
  WorkoutOptionsContext,
} from '~/contexts';
import { VITE_SUPABASE_URL } from '../env';
import { server } from '~/mocks/server';

import { useLogWorkout } from './useLogWorkout';

const WORKOUT_LOGS_URL = `${VITE_SUPABASE_URL}/rest/v1/workout_logs`;
const MOVEMENT_LOGS_URL = `${VITE_SUPABASE_URL}/rest/v1/movement_logs`;

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

const defaultMovement = {
  ...DEFAULT_MOVEMENT_OPTIONS,
  movementName: 'Kettlebell Swing',
};

function makeWrapper(complexSet: boolean) {
  const workoutOptions = {
    ...DEFAULT_WORKOUT_OPTIONS,
    complexSet,
    movements: [defaultMovement],
  };

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        SessionProvider,
        { value: mockSession },
        React.createElement(
          WorkoutOptionsContext.Provider,
          { value: [workoutOptions, () => {}] },
          children,
        ),
      ),
    );
}

const logWorkoutInput = {
  completedReps: 5,
  completedRounds: 1,
  completedRungs: 1,
  completedVolume: 120,
};

describe('useLogWorkout — complex_set persistence', () => {
  beforeEach(() => {
    server.use(
      http.post(MOVEMENT_LOGS_URL, () => HttpResponse.json([])),
    );
  });

  test('sends complex_set: true when complexSet is true', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    server.use(
      http.post(WORKOUT_LOGS_URL, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([{ id: 1 }]);
      }),
    );

    const { result } = renderHook(() => useLogWorkout(), {
      wrapper: makeWrapper(true),
    });

    act(() => {
      result.current.mutate(logWorkoutInput);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.complex_set).toBe(true);
  });

  test('sends complex_set: false when complexSet is false', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    server.use(
      http.post(WORKOUT_LOGS_URL, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([{ id: 1 }]);
      }),
    );

    const { result } = renderHook(() => useLogWorkout(), {
      wrapper: makeWrapper(false),
    });

    act(() => {
      result.current.mutate(logWorkoutInput);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.complex_set).toBe(false);
  });
});
