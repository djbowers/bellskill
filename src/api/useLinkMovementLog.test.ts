import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import { SessionProvider } from '~/contexts';
import { VITE_SUPABASE_URL } from '../env';
import { server } from '~/mocks/server';

import { linkMovementLog, useLinkMovementLog } from './useLinkMovementLog';

const MOVEMENT_LOGS_URL = `${VITE_SUPABASE_URL}/rest/v1/movement_logs`;
const WORKOUT_LOGS_URL = `${VITE_SUPABASE_URL}/rest/v1/workout_logs`;
const USER_MOVEMENTS_URL = `${VITE_SUPABASE_URL}/rest/v1/user_movements`;

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

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(SessionProvider, { value: mockSession }, children),
    );
}

describe('linkMovementLog', () => {
  test('updates movement_log and workout_logs.movements array', async () => {
    let movementLogPatch: Record<string, unknown> | null = null;
    let workoutLogPatch: Record<string, unknown> | null = null;

    server.use(
      http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
      http.post(USER_MOVEMENTS_URL, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([
          {
            id: 'um-new',
            canonical_name: body.canonical_name,
            functional_movement_id: body.functional_movement_id,
          },
        ]);
      }),
      http.patch(MOVEMENT_LOGS_URL, async ({ request }) => {
        movementLogPatch = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([]);
      }),
      http.get(`${WORKOUT_LOGS_URL}`, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('id') === 'eq.42') {
          return HttpResponse.json({
            movements: ['Old Name', 'Second Move'],
          });
        }
        return HttpResponse.json(null);
      }),
      http.patch(WORKOUT_LOGS_URL, async ({ request }) => {
        workoutLogPatch = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([]);
      }),
    );

    await linkMovementLog({
      userId: 'user-123',
      workoutLogId: 42,
      movementLogId: 7,
      movementIndex: 0,
      canonicalName: 'Kettlebell Swing',
      functionalMovementId: 'mov-catalog-1',
    });

    expect(movementLogPatch).toEqual({
      movement_name: 'Kettlebell Swing',
      user_movement_id: 'um-new',
    });
    expect(workoutLogPatch).toEqual({
      movements: ['Kettlebell Swing', 'Second Move'],
    });
  });
});

describe('useLinkMovementLog', () => {
  test('calls linkMovementLog via mutate', async () => {
    server.use(
      http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
      http.post(USER_MOVEMENTS_URL, () =>
        HttpResponse.json([{ id: 'um-1', canonical_name: 'Test' }]),
      ),
      http.patch(MOVEMENT_LOGS_URL, () => HttpResponse.json([])),
      http.get(WORKOUT_LOGS_URL, () =>
        HttpResponse.json({ movements: ['Test'] }),
      ),
      http.patch(WORKOUT_LOGS_URL, () => HttpResponse.json([])),
    );

    const { result } = renderHook(() => useLinkMovementLog(42), {
      wrapper: makeWrapper(),
    });

    act(() => {
      result.current.mutate({
        movementLogId: 1,
        movementIndex: 0,
        canonicalName: 'Test',
        functionalMovementId: 'mov-1',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
