import { renderHook } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';
import { useSetProgramStage } from './useSetProgramStage';

const RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/set_program_stage`;

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

describe('useSetProgramStage', () => {
  beforeEach(() => showToast.mockClear());

  it('calls the set_program_stage RPC and resolves with the rewritten count', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(6);
      }),
    );

    const { result } = renderHook(() => useSetProgramStage(), {
      wrapper: makeWrapper(),
    });

    const updated = await result.current.mutateAsync({
      userProgramId: 'up-1',
      stageIndex: 2,
    });

    expect(updated).toBe(6);
    expect(receivedBody).toEqual({
      p_user_program_id: 'up-1',
      p_stage_index: 2,
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('toasts the shared program error message on failure', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useSetProgramStage(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({ userProgramId: 'up-1', stageIndex: 1 }),
    ).rejects.toBeTruthy();

    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });
});
