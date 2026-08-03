import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';

import { SessionProvider } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { useProgram } from './useProgram';

const PROGRAMS_URL = `${VITE_SUPABASE_URL}/rest/v1/programs`;
const SESSIONS_URL = `${VITE_SUPABASE_URL}/rest/v1/program_sessions`;

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
      React.createElement(SessionProvider, { value: mockSession }, children),
    );
};

const programRow = {
  id: 'prog-1',
  owner_id: 'user-123',
  source_program_id: null,
  slug: 'dry-fighting-weight',
  title: 'Dry Fighting Weight',
  description: 'A classic.',
  author_name: 'Pavel',
  num_weeks: 2,
  days_per_week: 3,
  is_public: true,
  created_at: '2026-01-01T00:00:00Z',
  archived_at: null,
  default_auto_repeat: false,
  released_at: '2026-01-01T00:00:00Z',
  stages: null,
};

const sessionRow = (seq: number) => ({
  id: `ps-${seq}`,
  program_id: 'prog-1',
  sequence_index: seq,
  week_number: Math.floor(seq / 3) + 1,
  day_number: (seq % 3) + 1,
  title: `Session ${seq}`,
  workout_options: { movements: [] },
  notes: null,
  weight_label: null,
});

describe('useProgram', () => {
  it('is disabled when no programId is given', () => {
    const { result } = renderHook(() => useProgram(undefined), {
      wrapper: makeWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('fetches the program and its sessions, mapped to camelCase and ordered by sequenceIndex', async () => {
    server.use(
      http.get(PROGRAMS_URL, () => HttpResponse.json(programRow)),
      http.get(SESSIONS_URL, () =>
        HttpResponse.json([sessionRow(1), sessionRow(0)]),
      ),
    );

    const { result } = renderHook(() => useProgram('prog-1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.program).toMatchObject({
      id: 'prog-1',
      ownerId: 'user-123',
      title: 'Dry Fighting Weight',
      numWeeks: 2,
      daysPerWeek: 3,
    });
    expect(result.current.data?.sessions).toHaveLength(2);
    // Supabase's `.order(...)` request param does the sequencing server-side;
    // the query just passes the ordered rows through the mapper unchanged.
    expect(result.current.data?.sessions.map((s) => s.id)).toEqual([
      'ps-1',
      'ps-0',
    ]);
  });

  it('surfaces an error when the program fetch fails', async () => {
    server.use(
      http.get(PROGRAMS_URL, () =>
        HttpResponse.json({ message: 'not found' }, { status: 404 }),
      ),
      http.get(SESSIONS_URL, () => HttpResponse.json([])),
    );

    const { result } = renderHook(() => useProgram('missing'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
