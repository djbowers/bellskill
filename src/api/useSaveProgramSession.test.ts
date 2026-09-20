import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';

import { QUERIES } from '~/constants';
import { ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';
import { useSaveProgramSession } from './useSaveProgramSession';

const SESSIONS_URL = `${VITE_SUPABASE_URL}/rest/v1/program_sessions`;
const COMPACT_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/compact_program_sessions`;

const showToast = vi.fn();

const sessionRow = {
  id: 'session-1',
  program_id: 'program-1',
  sequence_index: 0,
  week_number: 1,
  day_number: 1,
  title: 'Day 1',
  workout_options: {},
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
};

const input = {
  programId: 'program-1',
  sequenceIndex: 0,
  weekNumber: 1,
  dayNumber: 1,
  title: 'Day 1',
  workoutOptions: {} as never,
};

const makeWrapperWithClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        ToastContext.Provider,
        { value: { showToast } },
        children,
      ),
    );
  return { wrapper, queryClient };
};

const makeWrapper = () => makeWrapperWithClient().wrapper;

describe('useSaveProgramSession', () => {
  beforeEach(() => showToast.mockClear());

  it('saves the session, compacts the program, and does not toast on success', async () => {
    let compactBody: unknown;
    server.use(
      http.post(SESSIONS_URL, () => HttpResponse.json(sessionRow)),
      http.post(COMPACT_URL, async ({ request }) => {
        compactBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useSaveProgramSession(), {
      wrapper: makeWrapper(),
    });

    const saved = await result.current.mutateAsync(input);

    expect(saved.id).toBe('session-1');
    expect(compactBody).toEqual({ p_program_id: 'program-1' });
    expect(showToast).not.toHaveBeenCalled();
  });

  it('refetches the program when the compact call fails after the insert', async () => {
    server.use(
      http.post(SESSIONS_URL, () => HttpResponse.json(sessionRow)),
      http.post(COMPACT_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );
    const { wrapper, queryClient } = makeWrapperWithClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSaveProgramSession(), { wrapper });

    await expect(result.current.mutateAsync(input)).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [QUERIES.PROGRAM, 'program-1'],
    });
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });

  it('toasts on failure', async () => {
    server.use(
      http.post(SESSIONS_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useSaveProgramSession(), {
      wrapper: makeWrapper(),
    });

    await expect(result.current.mutateAsync(input)).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });
});
