import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { useDeleteProgram } from './useDeleteProgram';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';

const PROGRAMS_URL = `${VITE_SUPABASE_URL}/rest/v1/programs`;

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

describe('useDeleteProgram', () => {
  beforeEach(() => showToast.mockClear());

  it('deletes the program by id and does not toast on success', async () => {
    let receivedUrl = '';
    server.use(
      http.delete(PROGRAMS_URL, ({ request }) => {
        receivedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useDeleteProgram(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ programId: 'prog-1' });

    expect(receivedUrl).toContain('id=eq.prog-1');
    expect(showToast).not.toHaveBeenCalled();
  });

  it('surfaces errors and toasts on failure', async () => {
    server.use(
      http.delete(PROGRAMS_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useDeleteProgram(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({ programId: 'prog-1' }),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });
});
