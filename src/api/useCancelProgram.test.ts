import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { useCancelProgram } from './useCancelProgram';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';

const USER_PROGRAMS_URL = `${VITE_SUPABASE_URL}/rest/v1/user_programs`;

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

describe('useCancelProgram', () => {
  beforeEach(() => showToast.mockClear());

  it('abandons the active enrollment and does not toast on success', async () => {
    let receivedBody: unknown;
    let receivedUrl = '';
    server.use(
      http.patch(USER_PROGRAMS_URL, async ({ request }) => {
        receivedBody = await request.json();
        receivedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useCancelProgram(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ userProgramId: 'up-1' });

    // Flips to 'abandoned', scoped to the active row so a completed enrollment
    // is never touched.
    expect(receivedBody).toEqual({ status: 'abandoned' });
    expect(receivedUrl).toContain('id=eq.up-1');
    expect(receivedUrl).toContain('status=eq.active');
    expect(showToast).not.toHaveBeenCalled();
  });

  it('surfaces errors and toasts on failure', async () => {
    server.use(
      http.patch(USER_PROGRAMS_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useCancelProgram(), {
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
});
