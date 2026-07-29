import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';

import { SessionProvider } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { useQueuedPrograms } from './useQueuedPrograms';

const USER_PROGRAMS_URL = `${VITE_SUPABASE_URL}/rest/v1/user_programs`;

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

const queuedRow = (id: string, position: number) => ({
  id,
  user_id: 'user-123',
  program_id: `${id}-program`,
  status: 'queued',
  config: {},
  started_at: '2026-07-27T00:00:00Z',
  completed_at: null,
  active_slot: null,
  auto_repeat: false,
  cycles_completed: 0,
  queue_position: position,
  programs: {
    id: `${id}-program`,
    owner_id: 'user-123',
    source_program_id: 'shared-1',
    slug: null,
    title: `Program ${id}`,
    description: null,
    author_name: null,
    num_weeks: 4,
    days_per_week: 3,
    is_public: false,
    created_at: '',
    archived_at: null,
    default_auto_repeat: false,
  },
});

describe('useQueuedPrograms', () => {
  it('fetches queued enrollments in queue order and maps them to camelCase', async () => {
    let receivedUrl = '';
    server.use(
      http.get(USER_PROGRAMS_URL, ({ request }) => {
        receivedUrl = request.url;
        return HttpResponse.json([queuedRow('q-1', 1), queuedRow('q-2', 2)]);
      }),
    );

    const { result } = renderHook(() => useQueuedPrograms(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(receivedUrl).toContain('status=eq.queued');
    expect(receivedUrl).toContain('order=queue_position.asc');

    const [first, second] = result.current.data!;
    expect(first.enrollment.id).toBe('q-1');
    expect(first.enrollment.status).toBe('queued');
    expect(first.enrollment.queuePosition).toBe(1);
    expect(first.enrollment.activeSlot).toBeNull();
    expect(first.program.title).toBe('Program q-1');
    expect(second.enrollment.queuePosition).toBe(2);
  });
});
