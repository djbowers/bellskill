import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';
import { useSwapProgramMovement } from './useSwapProgramMovement';

const RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/swap_program_movement`;

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

describe('useSwapProgramMovement', () => {
  beforeEach(() => showToast.mockClear());

  it('passes the swap and weight fields to the RPC', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(4);
      }),
    );

    const { result } = renderHook(() => useSwapProgramMovement(), {
      wrapper: makeWrapper(),
    });

    const updatedCount = await result.current.mutateAsync({
      userProgramId: 'up-1',
      oldMovementName: 'Kettlebell Swing',
      newMovementName: 'Goblet Squat',
      weightOneValue: 20,
      weightOneUnit: 'kilograms',
      weightTwoValue: 16,
      weightTwoUnit: 'kilograms',
    });

    expect(updatedCount).toBe(4);
    expect(receivedBody).toEqual({
      p_user_program_id: 'up-1',
      p_old_movement_name: 'Kettlebell Swing',
      p_new_movement_name: 'Goblet Squat',
      p_weight_one_value: 20,
      p_weight_one_unit: 'kilograms',
      p_weight_two_value: 16,
      p_weight_two_unit: 'kilograms',
    });
  });

  it('omits null weight fields from the body', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(2);
      }),
    );

    const { result } = renderHook(() => useSwapProgramMovement(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      userProgramId: 'up-1',
      oldMovementName: 'Kettlebell Swing',
      newMovementName: 'Goblet Squat',
      weightOneValue: 24,
      weightOneUnit: 'pounds',
      weightTwoValue: null,
      weightTwoUnit: null,
    });

    expect(receivedBody).toEqual({
      p_user_program_id: 'up-1',
      p_old_movement_name: 'Kettlebell Swing',
      p_new_movement_name: 'Goblet Squat',
      p_weight_one_value: 24,
      p_weight_one_unit: 'pounds',
    });
  });

  it('surfaces RPC errors', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useSwapProgramMovement(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        userProgramId: 'up-1',
        oldMovementName: 'Kettlebell Swing',
        newMovementName: 'Goblet Squat',
        weightOneValue: null,
        weightOneUnit: null,
        weightTwoValue: null,
        weightTwoUnit: null,
      }),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });

  it('does not toast on the happy path', async () => {
    server.use(http.post(RPC_URL, () => HttpResponse.json(1)));

    const { result } = renderHook(() => useSwapProgramMovement(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      userProgramId: 'up-1',
      oldMovementName: 'Kettlebell Swing',
      newMovementName: 'Goblet Squat',
      weightOneValue: null,
      weightOneUnit: null,
      weightTwoValue: null,
      weightTwoUnit: null,
    });

    expect(showToast).not.toHaveBeenCalled();
  });
});
