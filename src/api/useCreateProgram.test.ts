import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { useCreateProgram } from './useCreateProgram';
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

const programRow = {
  id: 'program-1',
  owner_id: 'user-123',
  source_program_id: null,
  slug: null,
  title: 'My Program',
  description: null,
  author_name: null,
  num_weeks: 4,
  days_per_week: 3,
  is_public: false,
  created_at: '2026-01-01T00:00:00Z',
};

const input = { title: 'My Program' };

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

describe('useCreateProgram', () => {
  beforeEach(() => showToast.mockClear());

  it('inserts the program without a cadence and does not toast on success', async () => {
    let insertedBody: unknown;
    server.use(
      http.post(PROGRAMS_URL, async ({ request }) => {
        insertedBody = await request.json();
        return HttpResponse.json(programRow);
      }),
    );

    const { result } = renderHook(() => useCreateProgram(), {
      wrapper: makeWrapper(),
    });

    const created = await result.current.mutateAsync(input);

    expect(created.id).toBe('program-1');
    // Cadence is derived from sessions later, never sent at creation (PROD-237).
    expect(insertedBody).toEqual({
      owner_id: 'user-123',
      title: 'My Program',
      is_public: false,
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('toasts on failure', async () => {
    server.use(
      http.post(PROGRAMS_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useCreateProgram(), {
      wrapper: makeWrapper(),
    });

    await expect(result.current.mutateAsync(input)).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });
});
