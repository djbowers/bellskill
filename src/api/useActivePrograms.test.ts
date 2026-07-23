import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';

import { SessionProvider } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { useActivePrograms } from './useActivePrograms';

const base = `${VITE_SUPABASE_URL}/rest/v1`;

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
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(SessionProvider, { value: mockSession }, children),
    );
};

const programRow = (id: string, title: string) => ({
  id,
  owner_id: 'user-123',
  source_program_id: null,
  slug: null,
  title,
  description: null,
  author_name: 'Geoff Neupert',
  num_weeks: 5,
  days_per_week: 3,
  is_public: false,
  created_at: '',
  archived_at: null,
});

const sessionRow = (
  programId: string,
  seq: number,
  week: number,
  day: number,
  title: string,
) => ({
  id: `${programId}-ps-${seq}`,
  program_id: programId,
  sequence_index: seq,
  week_number: week,
  day_number: day,
  title,
  notes: null,
  workout_options: {
    complexSet: false,
    intervalTimer: 0,
    movements: [],
    restTimer: 0,
    sharedWeightOneUnit: null,
    sharedWeightOneValue: null,
    sharedWeightTwoUnit: null,
    sharedWeightTwoValue: null,
    title: null,
    preWorkoutNotes: null,
    workoutGoal: 30,
    workoutGoalUnits: 'minutes',
  },
});

const threeSessions = (programId: string) => [
  sessionRow(programId, 0, 1, 1, 'Ladders 1-2-3'),
  sessionRow(programId, 1, 1, 2, 'Sets of 1'),
  sessionRow(programId, 2, 1, 3, 'Sets of 2'),
];

const enrollmentRow = (
  id: string,
  programId: string,
  status: string,
  activeSlot: number | null,
  completedAt: string | null = null,
) => ({
  id,
  user_id: 'user-123',
  program_id: programId,
  status,
  config: {},
  started_at: '',
  completed_at: completedAt,
  active_slot: activeSlot,
});

/** PostgREST-style `?id=eq.<value>` / `?program_id=eq.<value>` extraction. */
const eqParam = (url: string, column: string) =>
  new URL(url).searchParams.get(column)?.replace('eq.', '') ?? '';

/**
 * Handlers that route by the filtered id, so several programs can be in flight
 * at once. `completions` maps a `user_program_id` to its satisfied sessions.
 */
const mockProgramData = (
  enrollments: ReturnType<typeof enrollmentRow>[],
  programs: ReturnType<typeof programRow>[],
  completions: Record<string, { id: string; at: string }[]>,
) => {
  server.use(
    http.get(`${base}/user_programs`, () => HttpResponse.json(enrollments)),
    http.get(`${base}/programs`, ({ request }) => {
      const id = eqParam(request.url, 'id');
      return HttpResponse.json(programs.find((p) => p.id === id));
    }),
    http.get(`${base}/program_sessions`, ({ request }) =>
      HttpResponse.json(threeSessions(eqParam(request.url, 'program_id'))),
    ),
    http.get(`${base}/program_session_completions`, ({ request }) => {
      const userProgramId = eqParam(request.url, 'user_program_id');
      return HttpResponse.json(
        (completions[userProgramId] ?? []).map(({ id, at }) => ({
          program_session_id: id,
          completed_at: at,
        })),
      );
    }),
  );
};

describe('useActivePrograms', () => {
  it('derives the next unsatisfied session and progress for an active enrollment', async () => {
    mockProgramData(
      [enrollmentRow('up-1', 'prog-a', 'active', 1)],
      [programRow('prog-a', 'Dry Fighting Weight')],
      // Session 0 already done → next is session 1.
      { 'up-1': [{ id: 'prog-a-ps-0', at: '2026-07-06T00:00:00Z' }] },
    );

    const { result } = renderHook(() => useActivePrograms(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [data] = result.current.data!;
    expect(result.current.data).toHaveLength(1);
    expect(data.nextSession?.session.id).toBe('prog-a-ps-1');
    expect(data.nextSession?.session.title).toBe('Sets of 1');
    expect(data.progress).toEqual({
      completed: 1,
      total: 3,
      week: 1,
      day: 2,
    });
    expect(data.isComplete).toBe(false);
    expect(data.lastWorkedAt).toBe('2026-07-06T00:00:00Z');
  });

  it('returns every active enrollment, least-recently-worked first', async () => {
    mockProgramData(
      [
        enrollmentRow('up-1', 'prog-a', 'active', 1),
        enrollmentRow('up-2', 'prog-b', 'active', 2),
        enrollmentRow('up-3', 'prog-c', 'active', 3),
      ],
      [
        programRow('prog-a', 'Dry Fighting Weight'),
        programRow('prog-b', '10,000 Swing Challenge'),
        programRow('prog-c', 'Easy Strength'),
      ],
      {
        'up-1': [{ id: 'prog-a-ps-0', at: '2026-07-20T00:00:00Z' }],
        'up-2': [{ id: 'prog-b-ps-0', at: '2026-07-10T00:00:00Z' }],
        // up-3 has never been worked, so it sorts ahead of both.
        'up-3': [],
      },
    );

    const { result } = renderHook(() => useActivePrograms(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.map((p) => p.program.title)).toEqual([
      'Easy Strength',
      '10,000 Swing Challenge',
      'Dry Fighting Weight',
    ]);
    // Each cursor is independent: prog-c is untouched, the others are one in.
    expect(result.current.data!.map((p) => p.progress.completed)).toEqual([
      0, 1, 1,
    ]);
    expect(result.current.data![0].nextSession?.session.id).toBe('prog-c-ps-0');
  });

  it('reports the complete state for a finished enrollment (no active)', async () => {
    mockProgramData(
      [
        enrollmentRow(
          'up-1',
          'prog-a',
          'completed',
          1,
          '2026-07-06T00:00:00Z',
        ),
      ],
      [programRow('prog-a', 'Dry Fighting Weight')],
      {
        'up-1': [
          { id: 'prog-a-ps-0', at: '2026-07-04T00:00:00Z' },
          { id: 'prog-a-ps-1', at: '2026-07-05T00:00:00Z' },
          { id: 'prog-a-ps-2', at: '2026-07-06T00:00:00Z' },
        ],
      },
    );

    const { result } = renderHook(() => useActivePrograms(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [data] = result.current.data!;
    expect(data.nextSession).toBeNull();
    expect(data.isComplete).toBe(true);
    expect(data.progress.completed).toBe(3);
  });

  it('drops the completed fallback once another program is running', async () => {
    mockProgramData(
      [
        enrollmentRow('up-1', 'prog-a', 'completed', 1, '2026-07-06T00:00:00Z'),
        enrollmentRow('up-2', 'prog-b', 'active', 1),
      ],
      [
        programRow('prog-a', 'Dry Fighting Weight'),
        programRow('prog-b', '10,000 Swing Challenge'),
      ],
      {},
    );

    const { result } = renderHook(() => useActivePrograms(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.map((p) => p.program.title)).toEqual([
      '10,000 Swing Challenge',
    ]);
  });

  it('returns an empty list when the user has no active or completed enrollment', async () => {
    server.use(http.get(`${base}/user_programs`, () => HttpResponse.json([])));

    const { result } = renderHook(() => useActivePrograms(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
