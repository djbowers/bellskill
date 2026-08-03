import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { useAdjustProgramWeights } from './useAdjustProgramWeights';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';

const RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/adjust_program_weights`;

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

describe('useAdjustProgramWeights', () => {
  beforeEach(() => showToast.mockClear());

  it('passes shared bell weights for a complex-set program', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(4);
      }),
    );

    const { result } = renderHook(() => useAdjustProgramWeights(), {
      wrapper: makeWrapper(),
    });

    const updatedCount = await result.current.mutateAsync({
      userProgramId: 'up-1',
      sharedWeightOneValue: 20,
      sharedWeightOneUnit: 'kilograms',
      sharedWeightTwoValue: 16,
      sharedWeightTwoUnit: 'kilograms',
    });

    expect(updatedCount).toBe(4);
    expect(receivedBody).toEqual({
      p_user_program_id: 'up-1',
      p_shared_weight_one_value: 20,
      p_shared_weight_one_unit: 'kilograms',
      p_shared_weight_two_value: 16,
      p_shared_weight_two_unit: 'kilograms',
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

    const { result } = renderHook(() => useAdjustProgramWeights(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      userProgramId: 'up-1',
      sharedWeightOneValue: 24,
      sharedWeightOneUnit: 'pounds',
      sharedWeightTwoValue: null,
      sharedWeightTwoUnit: null,
    });

    expect(receivedBody).toEqual({
      p_user_program_id: 'up-1',
      p_shared_weight_one_value: 24,
      p_shared_weight_one_unit: 'pounds',
    });
  });

  it('passes per-movement weights as p_movement_weights', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(3);
      }),
    );

    const { result } = renderHook(() => useAdjustProgramWeights(), {
      wrapper: makeWrapper(),
    });

    const movementWeights = [
      {
        movementName: 'Kettlebell Swing',
        weightOneValue: 28,
        weightOneUnit: 'kilograms' as const,
        weightTwoValue: null,
        weightTwoUnit: null,
      },
    ];

    await result.current.mutateAsync({
      userProgramId: 'up-1',
      movementWeights,
    });

    expect(receivedBody).toEqual({
      p_user_program_id: 'up-1',
      p_movement_weights: movementWeights,
    });
  });

  it('omits p_movement_weights when the array is empty', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json(0);
      }),
    );

    const { result } = renderHook(() => useAdjustProgramWeights(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      userProgramId: 'up-1',
      movementWeights: [],
    });

    expect(receivedBody).toEqual({ p_user_program_id: 'up-1' });
  });

  it('surfaces RPC errors', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useAdjustProgramWeights(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({ userProgramId: 'up-1' }),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });

  it('does not toast on the happy path', async () => {
    server.use(http.post(RPC_URL, () => HttpResponse.json(1)));

    const { result } = renderHook(() => useAdjustProgramWeights(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ userProgramId: 'up-1' });

    expect(showToast).not.toHaveBeenCalled();
  });
});
