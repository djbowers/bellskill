import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';

import { QUERIES } from '~/constants';
import { ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { ProgramWithSessions } from './useProgram';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';
import { useSetProgramSessionLayout } from './useSetProgramSessionLayout';

const RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/set_program_session_layout`;

const showToast = vi.fn();

const makeSession = (
  id: string,
  sequenceIndex: number,
  weekNumber: number,
  dayNumber: number,
) =>
  ({
    id,
    programId: 'prog-1',
    sequenceIndex,
    weekNumber,
    dayNumber,
    title: id,
  }) as ProgramWithSessions['sessions'][number];

const cached: ProgramWithSessions = {
  program: { id: 'prog-1' } as ProgramWithSessions['program'],
  sessions: [
    makeSession('s-0', 0, 1, 1),
    makeSession('s-1', 1, 1, 2),
    makeSession('s-2', 2, 2, 1),
  ],
};

const layout = [
  { id: 's-0', weekNumber: 1, dayNumber: 1 },
  { id: 's-2', weekNumber: 1, dayNumber: 2 },
  { id: 's-1', weekNumber: 2, dayNumber: 1 },
];

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData([QUERIES.PROGRAM, 'prog-1'], cached);
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        ToastContext.Provider,
        { value: { showToast } },
        children,
      ),
    );
  return { wrapper, queryClient };
};

const cachedSessions = (queryClient: QueryClient) =>
  queryClient
    .getQueryData<ProgramWithSessions>([QUERIES.PROGRAM, 'prog-1'])!
    .sessions.map((s) => [s.id, s.sequenceIndex, s.weekNumber, s.dayNumber]);

describe('useSetProgramSessionLayout', () => {
  beforeEach(() => showToast.mockClear());

  it('sends a snake_case layout to the RPC and reorders the cached program optimistically', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useSetProgramSessionLayout(), {
      wrapper,
    });

    await result.current.mutateAsync({ programId: 'prog-1', layout });

    expect(receivedBody).toEqual({
      p_program_id: 'prog-1',
      p_layout: [
        { id: 's-0', week_number: 1, day_number: 1 },
        { id: 's-2', week_number: 1, day_number: 2 },
        { id: 's-1', week_number: 2, day_number: 1 },
      ],
    });
    expect(cachedSessions(queryClient)).toEqual([
      ['s-0', 0, 1, 1],
      ['s-2', 1, 1, 2],
      ['s-1', 2, 2, 1],
    ]);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('rolls the cache back and toasts on failure', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );
    const { wrapper, queryClient } = makeWrapper();
    const { result } = renderHook(() => useSetProgramSessionLayout(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({ programId: 'prog-1', layout }),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(cachedSessions(queryClient)).toEqual([
      ['s-0', 0, 1, 1],
      ['s-1', 1, 1, 2],
      ['s-2', 2, 2, 1],
    ]);
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });
});
