import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SessionProvider } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { useProgramProgress } from './useProgramProgress';

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

const programRow = {
  id: 'prog-clone',
  owner_id: 'user-123',
  source_program_id: 'dfw',
  slug: null,
  title: 'Dry Fighting Weight',
  description: null,
  author_name: 'Geoff Neupert',
  num_weeks: 2,
  days_per_week: 2,
  is_public: false,
  created_at: '',
};

const sessionRow = (seq: number, week: number, day: number, title: string) => ({
  id: `ps-${seq}`,
  program_id: 'prog-clone',
  sequence_index: seq,
  week_number: week,
  day_number: day,
  title,
  notes: null,
  workout_options: {
    workoutMode: 'circuit',
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

// Two weeks × two days = four sessions.
const fourSessions = [
  sessionRow(0, 1, 1, 'W1D1'),
  sessionRow(1, 1, 2, 'W1D2'),
  sessionRow(2, 2, 1, 'W2D1'),
  sessionRow(3, 2, 2, 'W2D2'),
];

const enrollmentRow = {
  id: 'up-1',
  user_id: 'user-123',
  program_id: 'prog-clone',
  status: 'active',
  config: {},
  started_at: '',
  completed_at: null,
};

describe('useProgramProgress', () => {
  it('derives done/skipped/upcoming states, counts, and week grouping', async () => {
    server.use(
      http.get(`${base}/programs`, () => HttpResponse.json(programRow)),
      http.get(`${base}/program_sessions`, () =>
        HttpResponse.json(fourSessions),
      ),
      http.get(`${base}/user_programs`, () =>
        HttpResponse.json([enrollmentRow]),
      ),
      // Session 0 completed (links to log 42), session 1 skipped, sessions 2-3 upcoming.
      http.get(`${base}/program_session_completions`, () =>
        HttpResponse.json([
          {
            id: 'c-0',
            user_program_id: 'up-1',
            program_session_id: 'ps-0',
            user_id: 'user-123',
            workout_log_id: 42,
            status: 'completed',
            completed_at: '2026-07-01T00:00:00Z',
          },
          {
            id: 'c-1',
            user_program_id: 'up-1',
            program_session_id: 'ps-1',
            user_id: 'user-123',
            workout_log_id: null,
            status: 'skipped',
            completed_at: '2026-07-02T00:00:00Z',
          },
        ]),
      ),
    );

    const { result } = renderHook(() => useProgramProgress('prog-clone'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = result.current.data!;

    expect(data.completedCount).toBe(2);
    expect(data.totalCount).toBe(4);
    expect(data.totalWeeks).toBe(2);
    // Next unsatisfied session is W2D1 → current week 2.
    expect(data.currentWeek).toBe(2);
    expect(data.isComplete).toBe(false);

    expect(data.weeks).toHaveLength(2);
    expect(data.weeks[0].weekNumber).toBe(1);
    expect(data.weeks[1].weekNumber).toBe(2);

    const [done, skipped] = data.weeks[0].sessions;
    expect(done.state).toBe('done');
    expect(done.workoutLogId).toBe(42);
    expect(skipped.state).toBe('skipped');
    expect(skipped.workoutLogId).toBeNull();

    expect(data.weeks[1].sessions.map((s) => s.state)).toEqual([
      'upcoming',
      'upcoming',
    ]);
  });

  it('reports every session upcoming when the user has no enrollment', async () => {
    server.use(
      http.get(`${base}/programs`, () => HttpResponse.json(programRow)),
      http.get(`${base}/program_sessions`, () =>
        HttpResponse.json(fourSessions),
      ),
      http.get(`${base}/user_programs`, () => HttpResponse.json([])),
    );

    const { result } = renderHook(() => useProgramProgress('prog-clone'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = result.current.data!;

    expect(data.enrollment).toBeNull();
    expect(data.completedCount).toBe(0);
    expect(data.totalCount).toBe(4);
    expect(data.currentWeek).toBe(1);
    expect(data.isComplete).toBe(false);
    expect(
      data.weeks
        .flatMap((w) => w.sessions)
        .every((s) => s.state === 'upcoming'),
    ).toBe(true);
  });

  it('is complete once every session is satisfied', async () => {
    server.use(
      http.get(`${base}/programs`, () => HttpResponse.json(programRow)),
      http.get(`${base}/program_sessions`, () =>
        HttpResponse.json(fourSessions),
      ),
      http.get(`${base}/user_programs`, () =>
        HttpResponse.json([
          { ...enrollmentRow, status: 'completed', completed_at: '2026-07-06' },
        ]),
      ),
      http.get(`${base}/program_session_completions`, () =>
        HttpResponse.json(
          fourSessions.map((s, i) => ({
            id: `c-${i}`,
            user_program_id: 'up-1',
            program_session_id: s.id,
            user_id: 'user-123',
            workout_log_id: i,
            status: 'completed',
            completed_at: '2026-07-06T00:00:00Z',
          })),
        ),
      ),
    );

    const { result } = renderHook(() => useProgramProgress('prog-clone'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = result.current.data!;

    expect(data.completedCount).toBe(4);
    expect(data.isComplete).toBe(true);
    // No upcoming session → current week falls back to the last week.
    expect(data.currentWeek).toBe(2);
  });
});
