import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';
import { useSetProgramReleased } from './useSetProgramReleased';

const RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/set_program_released`;

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

describe('useSetProgramReleased', () => {
  beforeEach(() => showToast.mockClear());

  it.each([true, false])(
    'calls the RPC with the program id and released=%s',
    async (released) => {
      let receivedBody: {
        p_program_id?: string;
        p_released?: boolean;
      } = {};
      server.use(
        http.post(RPC_URL, async ({ request }) => {
          receivedBody = (await request.json()) as typeof receivedBody;
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const { result } = renderHook(() => useSetProgramReleased(), {
        wrapper: makeWrapper(),
      });

      await result.current.mutateAsync({ programId: 'prog-1', released });

      expect(receivedBody).toEqual({
        p_program_id: 'prog-1',
        p_released: released,
      });
      expect(showToast).not.toHaveBeenCalled();
    },
  );

  it('surfaces errors and toasts on failure', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useSetProgramReleased(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({ programId: 'prog-1', released: true }),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });
});
