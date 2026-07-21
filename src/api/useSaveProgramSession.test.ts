import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';
import { useSaveProgramSession } from './useSaveProgramSession';

const SESSIONS_URL = `${VITE_SUPABASE_URL}/rest/v1/program_sessions`;

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

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        ToastContext.Provider,
        { value: { showToast } },
        children,
      ),
    );
};

describe('useSaveProgramSession', () => {
  beforeEach(() => showToast.mockClear());

  it('saves the session and does not toast on success', async () => {
    server.use(http.post(SESSIONS_URL, () => HttpResponse.json(sessionRow)));

    const { result } = renderHook(() => useSaveProgramSession(), {
      wrapper: makeWrapper(),
    });

    const saved = await result.current.mutateAsync(input);

    expect(saved.id).toBe('session-1');
    expect(showToast).not.toHaveBeenCalled();
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
