import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http, delay } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { QUERIES } from '~/constants';
import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';
import { ProgramProgressResult } from './useProgramProgress';
import { useSetProgramAutoRepeat } from './useSetProgramAutoRepeat';

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

const progressKey = [QUERIES.PROGRAM_PROGRESS, 'prog-1', 'user-123'];

const progressEntry = {
  enrollment: { id: 'up-1', status: 'active', autoRepeat: false },
} as ProgramProgressResult;

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
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
  return { queryClient, wrapper };
};

describe('useSetProgramAutoRepeat', () => {
  beforeEach(() => showToast.mockClear());

  it('patches the enrollment with the new auto_repeat value', async () => {
    let receivedBody: { auto_repeat?: boolean } = {};
    let receivedUrl = '';
    server.use(
      http.patch(USER_PROGRAMS_URL, async ({ request }) => {
        receivedBody = (await request.json()) as { auto_repeat?: boolean };
        receivedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetProgramAutoRepeat(), {
      wrapper,
    });

    await result.current.mutateAsync({ userProgramId: 'up-1', autoRepeat: true });

    expect(receivedUrl).toContain('id=eq.up-1');
    expect(receivedBody.auto_repeat).toBe(true);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('optimistically flips the cached progress enrollment before the request resolves', async () => {
    server.use(
      http.patch(USER_PROGRAMS_URL, async () => {
        await delay(50);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(progressKey, progressEntry);

    const { result } = renderHook(() => useSetProgramAutoRepeat(), {
      wrapper,
    });

    result.current.mutate({ userProgramId: 'up-1', autoRepeat: true });

    await waitFor(() => {
      const cached = queryClient.getQueryData<ProgramProgressResult>(progressKey);
      expect(cached?.enrollment?.autoRepeat).toBe(true);
    });
    expect(result.current.isPending).toBe(true);
  });

  it('leaves other enrollments untouched', async () => {
    server.use(
      http.patch(USER_PROGRAMS_URL, async () => {
        await delay(50);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const otherKey = [QUERIES.PROGRAM_PROGRESS, 'prog-2', 'user-123'];
    const otherEntry = {
      enrollment: { id: 'up-2', status: 'active', autoRepeat: false },
    } as ProgramProgressResult;

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(otherKey, otherEntry);

    const { result } = renderHook(() => useSetProgramAutoRepeat(), {
      wrapper,
    });

    result.current.mutate({ userProgramId: 'up-1', autoRepeat: true });

    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(queryClient.getQueryData(otherKey)).toBe(otherEntry);
  });

  it('rolls back the optimistic flip and toasts on failure', async () => {
    server.use(
      http.patch(USER_PROGRAMS_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(progressKey, progressEntry);

    const { result } = renderHook(() => useSetProgramAutoRepeat(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({ userProgramId: 'up-1', autoRepeat: true }),
    ).rejects.toBeTruthy();

    await waitFor(() => {
      const cached = queryClient.getQueryData<ProgramProgressResult>(progressKey);
      expect(cached?.enrollment?.autoRepeat).toBe(false);
    });
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });
});
