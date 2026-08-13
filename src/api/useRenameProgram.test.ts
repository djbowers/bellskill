import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';
import { useRenameProgram } from './useRenameProgram';

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

describe('useRenameProgram', () => {
  beforeEach(() => showToast.mockClear());

  it('updates the title of the targeted program, trimmed', async () => {
    let receivedBody: { title?: string } = {};
    let receivedUrl = '';
    server.use(
      http.patch(PROGRAMS_URL, async ({ request }) => {
        receivedBody = (await request.json()) as { title?: string };
        receivedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useRenameProgram(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      programId: 'prog-1',
      title: '  Dry Fighting Weight  ',
    });

    expect(receivedUrl).toContain('id=eq.prog-1');
    expect(receivedBody.title).toBe('Dry Fighting Weight');
    expect(showToast).not.toHaveBeenCalled();
  });

  it('surfaces errors and toasts on failure', async () => {
    server.use(
      http.patch(PROGRAMS_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useRenameProgram(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({ programId: 'prog-1', title: 'New name' }),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });
});
