import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import {
  useDequeueProgram,
  useStartQueuedProgram,
} from './useDequeueProgram';

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

describe('useDequeueProgram', () => {
  beforeEach(() => showToast.mockClear());

  it('abandons the queued row and clears its position', async () => {
    let receivedBody: Record<string, unknown> = {};
    let receivedUrl = '';
    server.use(
      http.patch(USER_PROGRAMS_URL, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>;
        receivedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useDequeueProgram(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ userProgramId: 'q-1' });

    expect(receivedUrl).toContain('id=eq.q-1');
    expect(receivedUrl).toContain('status=eq.queued');
    expect(receivedBody).toEqual({ status: 'abandoned', queue_position: null });
    expect(showToast).not.toHaveBeenCalled();
  });
});

describe('useStartQueuedProgram', () => {
  beforeEach(() => showToast.mockClear());

  it('activates the queued row onto the given slot', async () => {
    let receivedBody: Record<string, unknown> = {};
    let receivedUrl = '';
    server.use(
      http.patch(USER_PROGRAMS_URL, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>;
        receivedUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useStartQueuedProgram(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ userProgramId: 'q-1', slot: 2 });

    expect(receivedUrl).toContain('id=eq.q-1');
    expect(receivedUrl).toContain('status=eq.queued');
    expect(receivedBody).toMatchObject({
      status: 'active',
      active_slot: 2,
      queue_position: null,
    });
    expect(typeof receivedBody.started_at).toBe('string');
  });
});
