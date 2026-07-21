import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SessionProvider } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { useCompleteProgramSession } from './useCompleteProgramSession';

const RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/complete_program_session`;

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

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(SessionProvider, { value: mockSession }, children),
    );
};

describe('useCompleteProgramSession', () => {
  it('completes a session with its workout_log_id and resolves the program-complete flag', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        // The RPC returns true when this call finished the whole program.
        return HttpResponse.json(true);
      }),
    );

    const { result } = renderHook(() => useCompleteProgramSession(), {
      wrapper: makeWrapper(),
    });

    const done = await result.current.mutateAsync({
      userProgramId: 'up-1',
      programSessionId: 'ps-9',
      workoutLogId: 42,
    });

    expect(done).toBe(true);
    expect(receivedBody).toEqual({
      p_user_program_id: 'up-1',
      p_program_session_id: 'ps-9',
      p_workout_log_id: 42,
      p_status: 'completed',
    });
  });

  it('records a skip with no workout_log_id (status skipped)', async () => {
    let receivedBody: Record<string, unknown> | undefined;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(false);
      }),
    );

    const { result } = renderHook(() => useCompleteProgramSession(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      userProgramId: 'up-1',
      programSessionId: 'ps-9',
      status: 'skipped',
    });

    expect(receivedBody).toMatchObject({
      p_user_program_id: 'up-1',
      p_program_session_id: 'ps-9',
      p_status: 'skipped',
    });
    // No workout_log_id sent for a skip — the RPC's NULL default applies.
    expect(receivedBody?.p_workout_log_id).toBeUndefined();
  });

  it('surfaces RPC errors', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useCompleteProgramSession(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        userProgramId: 'up-1',
        programSessionId: 'ps-9',
        workoutLogId: 1,
      }),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
