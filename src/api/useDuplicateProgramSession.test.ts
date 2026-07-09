import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import { ToastContext } from '~/contexts';
import { server } from '~/mocks/server';
import { ProgramSession } from '~/types';

import { VITE_SUPABASE_URL } from '../env';
import {
  useDuplicateProgramSession,
  useDuplicateProgramWeek,
} from './useDuplicateProgramSession';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';

const SESSIONS_URL = `${VITE_SUPABASE_URL}/rest/v1/program_sessions`;

const showToast = vi.fn();

const session: ProgramSession = {
  id: 'session-1',
  programId: 'program-1',
  sequenceIndex: 0,
  weekNumber: 1,
  dayNumber: 1,
  title: 'Day 1',
  workoutOptions: {} as never,
  notes: null,
};

const sessionRow = {
  id: 'session-2',
  program_id: 'program-1',
  sequence_index: 1,
  week_number: 1,
  day_number: 1,
  title: 'Day 1',
  workout_options: {},
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
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

describe('useDuplicateProgramSession', () => {
  beforeEach(() => showToast.mockClear());

  const input = { session, sequenceIndex: 1, weekNumber: 1, dayNumber: 1 };

  it('duplicates the session and does not toast on success', async () => {
    server.use(http.post(SESSIONS_URL, () => HttpResponse.json(sessionRow)));

    const { result } = renderHook(() => useDuplicateProgramSession(), {
      wrapper: makeWrapper(),
    });

    const copy = await result.current.mutateAsync(input);

    expect(copy.id).toBe('session-2');
    expect(showToast).not.toHaveBeenCalled();
  });

  it('toasts on failure', async () => {
    server.use(
      http.post(SESSIONS_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useDuplicateProgramSession(), {
      wrapper: makeWrapper(),
    });

    await expect(result.current.mutateAsync(input)).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });
});

describe('useDuplicateProgramWeek', () => {
  beforeEach(() => showToast.mockClear());

  const input = {
    programId: 'program-1',
    sessions: [session],
    newWeekNumber: 2,
    startSequenceIndex: 1,
  };

  it('duplicates the week and does not toast on success', async () => {
    server.use(http.post(SESSIONS_URL, () => HttpResponse.json([sessionRow])));

    const { result } = renderHook(() => useDuplicateProgramWeek(), {
      wrapper: makeWrapper(),
    });

    const copies = await result.current.mutateAsync(input);

    expect(copies).toHaveLength(1);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('toasts on failure', async () => {
    server.use(
      http.post(SESSIONS_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useDuplicateProgramWeek(), {
      wrapper: makeWrapper(),
    });

    await expect(result.current.mutateAsync(input)).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });
});
