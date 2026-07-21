import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';
import { useUpdateProgramSession } from './useUpdateProgramSession';

const SESSIONS_URL = `${VITE_SUPABASE_URL}/rest/v1/program_sessions`;

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

const workoutOptions = {
  complexSet: false,
  intervalTimer: 0,
  restTimer: 0,
  workoutDetails: null,
  workoutGoal: 20,
  workoutGoalUnits: 'minutes' as const,
  sharedWeightOneValue: 24,
  sharedWeightOneUnit: 'kilograms' as const,
  sharedWeightTwoValue: null,
  sharedWeightTwoUnit: null,
  movements: [
    {
      movementName: 'Kettlebell Swing',
      repScheme: [10],
      weightOneValue: 24,
      weightOneUnit: 'kilograms' as const,
      weightTwoValue: null,
      weightTwoUnit: null,
    },
  ],
};

const sessionRow = {
  id: 's-1',
  program_id: 'prog-1',
  sequence_index: 0,
  week_number: 1,
  day_number: 1,
  title: 'Updated title',
  workout_options: workoutOptions,
  notes: null,
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

describe('useUpdateProgramSession', () => {
  beforeEach(() => showToast.mockClear());

  it('rewrites the session in place, scoped by id, and returns the mapped row', async () => {
    let receivedBody: Record<string, unknown> = {};
    let receivedUrl = '';
    server.use(
      http.patch(SESSIONS_URL, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>;
        receivedUrl = request.url;
        return HttpResponse.json(sessionRow);
      }),
    );

    const { result } = renderHook(() => useUpdateProgramSession(), {
      wrapper: makeWrapper(),
    });

    const updated = await result.current.mutateAsync({
      sessionId: 's-1',
      programId: 'prog-1',
      title: 'Updated title',
      workoutOptions,
    });

    expect(receivedUrl).toContain('id=eq.s-1');
    // Only title + options are written; sequence/week/day are left untouched.
    expect(receivedBody.title).toBe('Updated title');
    expect(receivedBody.workout_options).toBeTruthy();
    expect(receivedBody.sequence_index).toBeUndefined();
    expect(updated.id).toBe('s-1');
    expect(updated.title).toBe('Updated title');
    expect(showToast).not.toHaveBeenCalled();
  });

  it('surfaces errors and toasts on failure', async () => {
    server.use(
      http.patch(SESSIONS_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useUpdateProgramSession(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        sessionId: 's-1',
        programId: 'prog-1',
        title: 'x',
        workoutOptions,
      }),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });
});
