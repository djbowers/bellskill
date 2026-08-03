import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';
import { useResumeProgram } from './useResumeProgram';

const RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/resume_program`;

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

describe('useResumeProgram', () => {
  beforeEach(() => showToast.mockClear());

  it('calls resume_program with just the enrollment id when no slot swap is needed', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json('up-resumed');
      }),
    );

    const { result } = renderHook(() => useResumeProgram(), {
      wrapper: makeWrapper(),
    });

    const resumed = await result.current.mutateAsync({
      userProgramId: 'up-1',
    });

    expect(resumed).toBe('up-resumed');
    expect(receivedBody).toEqual({ p_user_program_id: 'up-1' });
  });

  it('passes p_replace_user_program_id when replacing a full slot', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json('up-resumed');
      }),
    );

    const { result } = renderHook(() => useResumeProgram(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      userProgramId: 'up-1',
      replaceUserProgramId: 'up-2',
    });

    expect(receivedBody).toEqual({
      p_user_program_id: 'up-1',
      p_replace_user_program_id: 'up-2',
    });
  });

  it('omits p_replace_user_program_id when it is null', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json('up-resumed');
      }),
    );

    const { result } = renderHook(() => useResumeProgram(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      userProgramId: 'up-1',
      replaceUserProgramId: null,
    });

    expect(receivedBody).toEqual({ p_user_program_id: 'up-1' });
  });

  it('surfaces RPC errors', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useResumeProgram(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({ userProgramId: 'up-1' }),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });

  it('does not toast on the happy path', async () => {
    server.use(http.post(RPC_URL, () => HttpResponse.json('up-resumed')));

    const { result } = renderHook(() => useResumeProgram(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ userProgramId: 'up-1' });

    expect(showToast).not.toHaveBeenCalled();
  });
});
