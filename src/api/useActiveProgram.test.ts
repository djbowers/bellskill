import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SessionProvider } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { useActiveProgram } from './useActiveProgram';

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
  num_weeks: 5,
  days_per_week: 3,
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
    complexSet: false,
    intervalTimer: 0,
    movements: [],
    restTimer: 0,
    sharedWeightOneUnit: null,
    sharedWeightOneValue: null,
    sharedWeightTwoUnit: null,
    sharedWeightTwoValue: null,
    workoutDetails: null,
    workoutGoal: 30,
    workoutGoalUnits: 'minutes',
  },
});

const threeSessions = [
  sessionRow(0, 1, 1, 'Ladders 1-2-3'),
  sessionRow(1, 1, 2, 'Sets of 1'),
  sessionRow(2, 1, 3, 'Sets of 2'),
];

describe('useActiveProgram', () => {
  it('derives the next unsatisfied session and progress for an active enrollment', async () => {
    server.use(
      http.get(`${base}/user_programs`, () =>
        HttpResponse.json([
          {
            id: 'up-1',
            user_id: 'user-123',
            program_id: 'prog-clone',
            status: 'active',
            config: {},
            started_at: '',
            completed_at: null,
          },
        ]),
      ),
      http.get(`${base}/programs`, () => HttpResponse.json(programRow)),
      http.get(`${base}/program_sessions`, () =>
        HttpResponse.json(threeSessions),
      ),
      // Session 0 already done → next is session 1.
      http.get(`${base}/program_session_completions`, () =>
        HttpResponse.json([{ program_session_id: 'ps-0' }]),
      ),
    );

    const { result } = renderHook(() => useActiveProgram(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.nextSession?.session.id).toBe('ps-1');
    expect(data.nextSession?.session.title).toBe('Sets of 1');
    expect(data.progress).toEqual({
      completed: 1,
      total: 3,
      week: 1,
      day: 2,
    });
    expect(data.isComplete).toBe(false);
  });

  it('reports the complete state for a finished enrollment (no active)', async () => {
    server.use(
      http.get(`${base}/user_programs`, () =>
        HttpResponse.json([
          {
            id: 'up-1',
            user_id: 'user-123',
            program_id: 'prog-clone',
            status: 'completed',
            config: {},
            started_at: '',
            completed_at: '2026-07-06T00:00:00Z',
          },
        ]),
      ),
      http.get(`${base}/programs`, () => HttpResponse.json(programRow)),
      http.get(`${base}/program_sessions`, () =>
        HttpResponse.json(threeSessions),
      ),
      http.get(`${base}/program_session_completions`, () =>
        HttpResponse.json([
          { program_session_id: 'ps-0' },
          { program_session_id: 'ps-1' },
          { program_session_id: 'ps-2' },
        ]),
      ),
    );

    const { result } = renderHook(() => useActiveProgram(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const data = result.current.data!;
    expect(data.nextSession).toBeNull();
    expect(data.isComplete).toBe(true);
    expect(data.progress.completed).toBe(3);
  });

  it('returns null when the user has no active or completed enrollment', async () => {
    server.use(http.get(`${base}/user_programs`, () => HttpResponse.json([])));

    const { result } = renderHook(() => useActiveProgram(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
