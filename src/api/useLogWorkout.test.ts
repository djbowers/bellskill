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
const USER_MOVEMENTS_URL = `${VITE_SUPABASE_URL}/rest/v1/user_movements`;
const ANALYTICS_URL = `${VITE_SUPABASE_URL}/rest/v1/analytics_events`;

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
      http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
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

describe('useLogWorkout — activation funnel analytics (PROD-157)', () => {
  beforeEach(() => {
    server.use(
      http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
      http.post(MOVEMENT_LOGS_URL, () => HttpResponse.json([])),
      http.post(WORKOUT_LOGS_URL, () => HttpResponse.json([{ id: 1 }])),
    );
  });

  test('emits is_first_workout: null (not false) when the WORKOUT_LOGS cache is cold', async () => {
    let analyticsBody: Record<string, unknown> | null = null;

    server.use(
      http.post(ANALYTICS_URL, async ({ request }) => {
        analyticsBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([]);
      }),
    );

    // The wrapper's query client never seeds WORKOUT_LOGS, so the cache is cold:
    // is_first_workout is unknown and must be null rather than a misleading false.
    const { result } = renderHook(() => useLogWorkout(), {
      wrapper: makeWrapper(false),
    });

    act(() => {
      result.current.mutate(logWorkoutInput);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(analyticsBody).not.toBeNull());

    const properties = analyticsBody!.properties as Record<string, unknown>;
    expect(analyticsBody!.event_name).toBe('workout_completed');
    expect(properties.is_first_workout).toBeNull();
    expect(properties.workout_log_id).toBe(1);
  });
});
