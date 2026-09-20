import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';

import { ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { useDeleteProgramWeek } from './useDeleteProgramWeek';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';

const RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/delete_program_week`;

const showToast = vi.fn();

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(
        ToastContext.Provider,
        { value: { showToast } },
        children,
      ),
    );
};

describe('useDeleteProgramWeek', () => {
  beforeEach(() => showToast.mockClear());

  it('sends the program id and week number and resolves to the deleted count', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(3);
      }),
    );

    const { result } = renderHook(() => useDeleteProgramWeek(), {
      wrapper: makeWrapper(),
    });

    const deleted = await result.current.mutateAsync({
      programId: 'prog-1',
      weekNumber: 2,
    });

    expect(receivedBody).toEqual({ p_program_id: 'prog-1', p_week_number: 2 });
    expect(deleted).toBe(3);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('toasts on failure', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useDeleteProgramWeek(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({ programId: 'prog-1', weekNumber: 2 }),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });
});
