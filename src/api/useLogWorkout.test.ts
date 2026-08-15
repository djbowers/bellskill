import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  DEFAULT_MOVEMENT_OPTIONS,
  DEFAULT_WORKOUT_OPTIONS,
  PendingProgramSession,
  ProgramSessionContext,
  ProgramSessionProvider,
  SessionProvider,
  WorkoutOptionsContext,
  useProgramSession,
} from '~/contexts';
import { QUERIES } from '~/constants';
import { WorkoutMode } from '~/types';
import { VITE_SUPABASE_URL } from '../env';
import { server } from '~/mocks/server';

import { useLogWorkout } from './useLogWorkout';

const WORKOUT_LOGS_URL = `${VITE_SUPABASE_URL}/rest/v1/workout_logs`;
const MOVEMENT_LOGS_URL = `${VITE_SUPABASE_URL}/rest/v1/movement_logs`;
const USER_MOVEMENTS_URL = `${VITE_SUPABASE_URL}/rest/v1/user_movements`;
const ANALYTICS_URL = `${VITE_SUPABASE_URL}/rest/v1/analytics_events`;

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

const defaultMovement = {
  ...DEFAULT_MOVEMENT_OPTIONS,
  movementName: 'Kettlebell Swing',
};

function makeWrapper(workoutMode: WorkoutMode = 'circuit') {
  const workoutOptions = {
    ...DEFAULT_WORKOUT_OPTIONS,
    workoutMode,
    movements: [defaultMovement],
  };

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
          WorkoutOptionsContext.Provider,
          { value: [workoutOptions, () => {}] },
          children,
        ),
      ),
    );
}

const logWorkoutInput = {
  completedReps: 5,
  completedRepsByMovement: [[5]],
  completedRounds: 1,
  completedRungs: 1,
  completedSides: 2,
  completedVolume: 120,
  roundSplits: [],
};

describe('useLogWorkout — workout mode persistence', () => {
  beforeEach(() => {
    server.use(
      http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
      http.post(MOVEMENT_LOGS_URL, () => HttpResponse.json([])),
    );
  });

  test.each([
    ['circuit', { complex_set: false, straight_sets: false }],
    ['straightSets', { complex_set: false, straight_sets: true }],
    ['complex', { complex_set: true, straight_sets: false }],
  ] as const)('%s mode writes the matching columns', async (mode, columns) => {
    let capturedBody: Record<string, unknown> | null = null;

    server.use(
      http.post(WORKOUT_LOGS_URL, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([{ id: 1 }]);
      }),
    );

    const { result } = renderHook(() => useLogWorkout(), {
      wrapper: makeWrapper(mode),
    });

    act(() => {
      result.current.mutate(logWorkoutInput);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.complex_set).toBe(columns.complex_set);
    expect(capturedBody!.straight_sets).toBe(columns.straight_sets);
  });

  test('persists completed_sides from the log input', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    server.use(
      http.post(WORKOUT_LOGS_URL, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([{ id: 1 }]);
      }),
    );

    const { result } = renderHook(() => useLogWorkout(), {
      wrapper: makeWrapper(),
    });

    act(() => {
      result.current.mutate(logWorkoutInput);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.completed_sides).toBe(logWorkoutInput.completedSides);
  });
});

describe('useLogWorkout — program session completion wiring (Slice 3)', () => {
  const COMPLETE_RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/complete_program_session`;

  function makeProgramWrapper(programSession: PendingProgramSession | null) {
    const workoutOptions = {
      ...DEFAULT_WORKOUT_OPTIONS,
      movements: [defaultMovement],
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const setProgramSession = vi.fn();

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(
          SessionProvider,
          { value: mockSession },
          React.createElement(
            WorkoutOptionsContext.Provider,
            { value: [workoutOptions, () => {}] },
            React.createElement(
              ProgramSessionContext.Provider,
              { value: [programSession, setProgramSession] },
              children,
            ),
          ),
        ),
      );

    return { wrapper, setProgramSession, queryClient };
  }

  beforeEach(() => {
    server.use(
      http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
      http.post(MOVEMENT_LOGS_URL, () => HttpResponse.json([])),
      http.post(WORKOUT_LOGS_URL, () => HttpResponse.json([{ id: 77 }])),
    );
  });

  test('advances the pending program session with the new workout log id', async () => {
    let rpcBody: Record<string, unknown> | null = null;

    server.use(
      http.post(COMPLETE_RPC_URL, async ({ request }) => {
        rpcBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(false);
      }),
    );

    const { wrapper } = makeProgramWrapper({
      userProgramId: 'up-1',
      programSessionId: 'ps-9',
    });

    const { result } = renderHook(() => useLogWorkout(), { wrapper });

    act(() => {
      result.current.mutate(logWorkoutInput);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(rpcBody).not.toBeNull());

    expect(rpcBody).toEqual({
      p_user_program_id: 'up-1',
      p_program_session_id: 'ps-9',
      p_workout_log_id: 77,
      p_status: 'completed',
    });
  });

  test('clears the pending session so a later non-program log cannot re-attach', async () => {
    server.use(http.post(COMPLETE_RPC_URL, () => HttpResponse.json(false)));

    const { wrapper, setProgramSession } = makeProgramWrapper({
      userProgramId: 'up-1',
      programSessionId: 'ps-9',
    });

    const { result } = renderHook(() => useLogWorkout(), { wrapper });

    act(() => {
      result.current.mutate(logWorkoutInput);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setProgramSession).toHaveBeenCalledWith(null);
  });

  test('invalidates the active-program query after the RPC resolves', async () => {
    server.use(http.post(COMPLETE_RPC_URL, () => HttpResponse.json(false)));

    const { wrapper, queryClient } = makeProgramWrapper({
      userProgramId: 'up-1',
      programSessionId: 'ps-9',
    });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useLogWorkout(), { wrapper });

    act(() => {
      result.current.mutate(logWorkoutInput);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: [QUERIES.ACTIVE_PROGRAM],
      }),
    );
  });

  test('does not call the RPC for a non-program workout', async () => {
    const rpc = vi.fn(() => HttpResponse.json(false));
    server.use(http.post(COMPLETE_RPC_URL, rpc));

    const { wrapper, setProgramSession } = makeProgramWrapper(null);

    const { result } = renderHook(() => useLogWorkout(), { wrapper });

    act(() => {
      result.current.mutate(logWorkoutInput);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Give the fire-and-forget path a tick to prove it never fires.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(setProgramSession).not.toHaveBeenCalled();
  });

  test('an RPC failure does not fail the workout log', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    server.use(
      http.post(COMPLETE_RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { wrapper } = makeProgramWrapper({
      userProgramId: 'up-1',
      programSessionId: 'ps-9',
    });

    const { result } = renderHook(() => useLogWorkout(), { wrapper });

    act(() => {
      result.current.mutate(logWorkoutInput);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to advance program session',
        expect.anything(),
      ),
    );
    expect(result.current.isError).toBe(false);

    consoleError.mockRestore();
  });

  test('the real provider hands the pending session through start → log → clear', async () => {
    let rpcBody: Record<string, unknown> | null = null;
    server.use(
      http.post(COMPLETE_RPC_URL, async ({ request }) => {
        rpcBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(false);
      }),
    );

    const workoutOptions = {
      ...DEFAULT_WORKOUT_OPTIONS,
      movements: [defaultMovement],
    };
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
            WorkoutOptionsContext.Provider,
            { value: [workoutOptions, () => {}] },
            React.createElement(ProgramSessionProvider, null, children),
          ),
        ),
      );

    const { result } = renderHook(
      () => ({
        log: useLogWorkout(),
        programSession: useProgramSession(),
      }),
      { wrapper },
    );

    // The provider starts empty (every non-program start leaves it null).
    expect(result.current.programSession[0]).toBeNull();

    act(() => {
      result.current.programSession[1]({
        userProgramId: 'up-7',
        programSessionId: 'ps-2',
      });
    });
    expect(result.current.programSession[0]).toEqual({
      userProgramId: 'up-7',
      programSessionId: 'ps-2',
    });

    act(() => {
      result.current.log.mutate(logWorkoutInput);
    });

    await waitFor(() => expect(result.current.log.isSuccess).toBe(true));
    await waitFor(() => expect(rpcBody).not.toBeNull());

    expect(rpcBody).toMatchObject({
      p_user_program_id: 'up-7',
      p_program_session_id: 'ps-2',
      p_workout_log_id: 77,
    });
    await waitFor(() => expect(result.current.programSession[0]).toBeNull());
  });
});

describe('useLogWorkout — activation funnel analytics (PROD-157)', () => {
  beforeEach(() => {
    server.use(
      http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
      http.post(MOVEMENT_LOGS_URL, () => HttpResponse.json([])),
      http.post(WORKOUT_LOGS_URL, () => HttpResponse.json([{ id: 1 }])),
    );
  });

  test('emits is_first_workout: null (not false) when the WORKOUT_LOGS cache is cold', async () => {
    let analyticsBody: Record<string, unknown> | null = null;

    server.use(
      http.post(ANALYTICS_URL, async ({ request }) => {
        analyticsBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([]);
      }),
    );

    // The wrapper's query client never seeds WORKOUT_LOGS, so the cache is cold:
    // is_first_workout is unknown and must be null rather than a misleading false.
    const { result } = renderHook(() => useLogWorkout(), {
      wrapper: makeWrapper(),
    });

    act(() => {
      result.current.mutate(logWorkoutInput);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(analyticsBody).not.toBeNull());

    const properties = analyticsBody!.properties as Record<string, unknown>;
    expect(analyticsBody!.event_name).toBe('workout_completed');
    expect(properties.is_first_workout).toBeNull();
    expect(properties.workout_log_id).toBe(1);
  });
});

describe('useLogWorkout — per-set actuals', () => {
  const makeMovementsWrapper = (
    movements: (typeof DEFAULT_MOVEMENT_OPTIONS)[],
  ) => {
    const workoutOptions = { ...DEFAULT_WORKOUT_OPTIONS, movements };
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
            WorkoutOptionsContext.Provider,
            { value: [workoutOptions, () => {}] },
            children,
          ),
        ),
      );
  };

  const logAndCaptureMovementRows = async (
    wrapper: ReturnType<typeof makeMovementsWrapper>,
    completedRepsByMovement: number[][],
  ) => {
    let rows: Record<string, unknown>[] = [];

    server.use(
      http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
      http.post(WORKOUT_LOGS_URL, () => HttpResponse.json([{ id: 5 }])),
      http.post(MOVEMENT_LOGS_URL, async ({ request }) => {
        rows = (await request.json()) as Record<string, unknown>[];
        return HttpResponse.json([]);
      }),
    );

    const { result } = renderHook(() => useLogWorkout(), { wrapper });

    act(() => {
      result.current.mutate({ ...logWorkoutInput, completedRepsByMovement });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    return rows;
  };

  test('a prescribed ladder keeps its plan and gains the actuals alongside it', async () => {
    const rows = await logAndCaptureMovementRows(
      makeMovementsWrapper([{ ...defaultMovement, repScheme: [5, 5] }]),
      [[5, 3]],
    );

    expect(rows[0]).toMatchObject({
      rep_scheme: [5, 5],
      completed_rep_scheme: [5, 3],
    });
  });

  // The plan is written verbatim, max rungs and all — 0 is what "to failure"
  // looks like on the way in, and the actuals carry what came of it.
  test('a ladder to max persists the 0 rung and what was hit', async () => {
    const rows = await logAndCaptureMovementRows(
      makeMovementsWrapper([{ ...defaultMovement, repScheme: [1, 2, 0] }]),
      [[1, 2, 12, 1, 2, 9]],
    );

    expect(rows[0]).toMatchObject({
      rep_scheme: [1, 2, 0],
      completed_rep_scheme: [1, 2, 12, 1, 2, 9],
    });
  });

  test('a timed movement records seconds, in the same unit as its plan', async () => {
    const rows = await logAndCaptureMovementRows(
      makeMovementsWrapper([
        { ...defaultMovement, repScheme: [30, 0], timedRungs: true },
      ]),
      [[30, 47]],
    );

    expect(rows[0]).toMatchObject({
      rep_scheme: [30, 0],
      completed_rep_scheme: [30, 47],
      timed_rungs: true,
    });
  });
});
