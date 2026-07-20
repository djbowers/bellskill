import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';
import { useSetProgramArchived } from './useSetProgramArchived';

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

describe('useSetProgramArchived', () => {
  beforeEach(() => showToast.mockClear());

  it('archives by setting a timestamp on archived_at', async () => {
    let receivedBody: { archived_at?: string | null } = {};
    let receivedUrl = '';
    server.use(
      http.patch(PROGRAMS_URL, async ({ request }) => {
        receivedBody = (await request.json()) as {
          archived_at?: string | null;
        };
        receivedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useSetProgramArchived(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ programId: 'prog-1', archived: true });

    expect(receivedUrl).toContain('id=eq.prog-1');
    expect(typeof receivedBody.archived_at).toBe('string');
    expect(showToast).not.toHaveBeenCalled();
  });

  it('restores by clearing archived_at to null', async () => {
    let receivedBody: { archived_at?: string | null } = {};
    server.use(
      http.patch(PROGRAMS_URL, async ({ request }) => {
        receivedBody = (await request.json()) as {
          archived_at?: string | null;
        };
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useSetProgramArchived(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ programId: 'prog-1', archived: false });

    expect(receivedBody.archived_at).toBeNull();
  });

  it('surfaces errors and toasts on failure', async () => {
    server.use(
      http.patch(PROGRAMS_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useSetProgramArchived(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({ programId: 'prog-1', archived: true }),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });
});
