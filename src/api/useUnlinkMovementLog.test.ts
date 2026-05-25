import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { unlinkMovementLog, useUnlinkMovementLog } from './useUnlinkMovementLog';

const MOVEMENT_LOGS_URL = `${VITE_SUPABASE_URL}/rest/v1/movement_logs`;

describe('unlinkMovementLog', () => {
  test('clears user_movement_id on the movement log', async () => {
    let movementLogPatch: Record<string, unknown> | null = null;

    server.use(
      http.patch(MOVEMENT_LOGS_URL, async ({ request }) => {
        movementLogPatch = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([]);
      }),
    );

    await unlinkMovementLog({ movementLogId: 7 });

    expect(movementLogPatch).toEqual({ user_movement_id: null });
  });
});

describe('useUnlinkMovementLog', () => {
  test('calls unlinkMovementLog via mutate', async () => {
    server.use(
      http.patch(MOVEMENT_LOGS_URL, () => HttpResponse.json([])),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { result } = renderHook(() => useUnlinkMovementLog(42), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          children,
        ),
    });

    act(() => {
      result.current.mutate({ movementLogId: 1 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
