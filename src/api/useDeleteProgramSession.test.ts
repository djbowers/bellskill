import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import { SessionProvider } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { useDeleteProgramSession } from './useDeleteProgramSession';

const RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/delete_program_session`;

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

describe('useDeleteProgramSession', () => {
  it('sends only the session id to the RPC (program id is used client-side)', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useDeleteProgramSession(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      sessionId: 's-1',
      programId: 'prog-1',
    });

    expect(receivedBody).toEqual({ p_session_id: 's-1' });
  });

  it('surfaces RPC errors', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useDeleteProgramSession(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({ sessionId: 's-1', programId: 'prog-1' }),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
