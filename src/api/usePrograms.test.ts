import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SessionProvider } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { usePrograms } from './usePrograms';

const PROGRAMS_URL = `${VITE_SUPABASE_URL}/rest/v1/programs`;

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

const programRow = (
  overrides: Record<string, unknown>,
  sessions: { week_number: number; day_number: number }[],
) => ({
  id: 'p',
  owner_id: 'user-123',
  source_program_id: null,
  slug: null,
  title: 'Program',
  description: null,
  author_name: null,
  // Stale/unset stored cadence — the hook must ignore it and derive from
  // sessions instead.
  num_weeks: null,
  days_per_week: null,
  is_public: false,
  created_at: '',
  program_sessions: sessions,
  ...overrides,
});

describe('usePrograms', () => {
  it('derives numWeeks/daysPerWeek from each program’s own sessions', async () => {
    // A 2-weeks-×-3-days layout: highest week 2, widest week 3 days.
    const sessions = [
      { week_number: 1, day_number: 1 },
      { week_number: 1, day_number: 2 },
      { week_number: 1, day_number: 3 },
      { week_number: 2, day_number: 1 },
      { week_number: 2, day_number: 2 },
      { week_number: 2, day_number: 3 },
    ];
    server.use(
      http.get(PROGRAMS_URL, () =>
        HttpResponse.json([programRow({ id: 'shaped' }, sessions)]),
      ),
    );

    const { result } = renderHook(() => usePrograms(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({
      id: 'shaped',
      numWeeks: 2,
      daysPerWeek: 3,
    });
  });

  it('prefers a program’s authored cadence columns over its sessions', async () => {
    // A sparsely-seeded shared program: only 2 days seeded, but authored 3/week.
    const sessions = [
      { week_number: 1, day_number: 1 },
      { week_number: 1, day_number: 2 },
    ];
    server.use(
      http.get(PROGRAMS_URL, () =>
        HttpResponse.json([
          programRow(
            { id: 'seeded', num_weeks: 4, days_per_week: 3 },
            sessions,
          ),
        ]),
      ),
    );

    const { result } = renderHook(() => usePrograms(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({
      id: 'seeded',
      numWeeks: 4,
      daysPerWeek: 3,
    });
  });

  it('reports null cadence for a program with no sessions yet', async () => {
    server.use(
      http.get(PROGRAMS_URL, () =>
        HttpResponse.json([programRow({ id: 'empty' }, [])]),
      ),
    );

    const { result } = renderHook(() => usePrograms(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({
      id: 'empty',
      numWeeks: null,
      daysPerWeek: null,
    });
  });
});
