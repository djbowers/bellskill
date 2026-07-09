import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { useEnrollProgram } from './useEnrollProgram';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';

const RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/enroll_in_program`;

const showToast = vi.fn();

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
      React.createElement(
        SessionProvider,
        { value: mockSession },
        React.createElement(
          ToastContext.Provider,
          { value: { showToast } },
          children,
        ),
      ),
    );
};

describe('useEnrollProgram', () => {
  beforeEach(() => showToast.mockClear());

  it('calls the enroll_in_program RPC and resolves with the new enrollment id', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json('new-user-program-id');
      }),
    );

    const { result } = renderHook(() => useEnrollProgram(), {
      wrapper: makeWrapper(),
    });

    const enrolled = await result.current.mutateAsync('program-abc');

    expect(enrolled).toBe('new-user-program-id');
    expect(receivedBody).toEqual({ p_program_id: 'program-abc' });
  });

  it('surfaces RPC errors', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useEnrollProgram(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync('program-abc'),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });

  it('does not toast on the happy path', async () => {
    server.use(
      http.post(RPC_URL, () => HttpResponse.json('new-user-program-id')),
    );

    const { result } = renderHook(() => useEnrollProgram(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync('program-abc');

    expect(showToast).not.toHaveBeenCalled();
  });
});
