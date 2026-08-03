import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';
import { WorkoutOptions } from '~/types';

import { VITE_SUPABASE_URL } from '../env';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';
import { useUpdateProgramSessionsForward } from './useUpdateProgramSessionsForward';

const SESSIONS_URL = `${VITE_SUPABASE_URL}/rest/v1/program_sessions`;
const RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/update_program_sessions_forward`;

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

const workoutOptions: Omit<WorkoutOptions, 'startedAt'> = {
  complexSet: false,
  intervalTimer: 0,
  movements: [
    {
      movementName: 'Kettlebell Swing',
      repScheme: [10],
      weightOneValue: 24,
      weightOneUnit: 'kilograms',
      weightTwoValue: null,
      weightTwoUnit: null,
    },
  ],
  restTimer: 0,
  sharedWeightOneUnit: null,
  sharedWeightOneValue: null,
  sharedWeightTwoUnit: null,
  sharedWeightTwoValue: null,
  title: null,
  preWorkoutNotes: null,
  workoutGoal: 30,
  workoutGoalUnits: 'minutes',
};

describe('useUpdateProgramSessionsForward', () => {
  beforeEach(() => showToast.mockClear());

  it('rewrites the session in full, then forwards only its prescription via RPC', async () => {
    let patchBody: unknown;
    let patchUrl = '';
    let rpcBody: unknown;
    server.use(
      http.patch(SESSIONS_URL, async ({ request }) => {
        patchBody = await request.json();
        patchUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
      http.post(RPC_URL, async ({ request }) => {
        rpcBody = await request.json();
        return HttpResponse.json(5);
      }),
    );

    const { result } = renderHook(() => useUpdateProgramSessionsForward(), {
      wrapper: makeWrapper(),
    });

    const updatedCount = await result.current.mutateAsync({
      sessionId: 'ps-1',
      programId: 'prog-1',
      title: 'Week 2 Day 1',
      workoutOptions,
    });

    expect(updatedCount).toBe(5);

    expect(patchUrl).toContain('id=eq.ps-1');
    expect(patchBody).toEqual({
      title: 'Week 2 Day 1',
      workout_options: workoutOptions,
    });

    expect(rpcBody).toEqual({
      p_session_id: 'ps-1',
      p_forward_options: {
        movements: workoutOptions.movements,
        sharedWeightOneValue: workoutOptions.sharedWeightOneValue,
        sharedWeightOneUnit: workoutOptions.sharedWeightOneUnit,
        sharedWeightTwoValue: workoutOptions.sharedWeightTwoValue,
        sharedWeightTwoUnit: workoutOptions.sharedWeightTwoUnit,
        complexSet: workoutOptions.complexSet,
      },
    });
  });

  it('does not call the RPC when the session update itself fails', async () => {
    let rpcCalled = false;
    server.use(
      http.patch(SESSIONS_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
      http.post(RPC_URL, () => {
        rpcCalled = true;
        return HttpResponse.json(5);
      }),
    );

    const { result } = renderHook(() => useUpdateProgramSessionsForward(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        sessionId: 'ps-1',
        programId: 'prog-1',
        title: 'Week 2 Day 1',
        workoutOptions,
      }),
    ).rejects.toBeTruthy();

    expect(rpcCalled).toBe(false);
  });

  it('surfaces RPC errors', async () => {
    server.use(
      http.patch(SESSIONS_URL, () => new HttpResponse(null, { status: 204 })),
      http.post(RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useUpdateProgramSessionsForward(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        sessionId: 'ps-1',
        programId: 'prog-1',
        title: 'Week 2 Day 1',
        workoutOptions,
      }),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });

  it('does not toast on the happy path', async () => {
    server.use(
      http.patch(SESSIONS_URL, () => new HttpResponse(null, { status: 204 })),
      http.post(RPC_URL, () => HttpResponse.json(1)),
    );

    const { result } = renderHook(() => useUpdateProgramSessionsForward(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      sessionId: 'ps-1',
      programId: 'prog-1',
      title: 'Week 2 Day 1',
      workoutOptions,
    });

    expect(showToast).not.toHaveBeenCalled();
  });
});
