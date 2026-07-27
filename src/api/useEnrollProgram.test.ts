import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SessionProvider, ToastContext } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { useEnrollProgram } from './useEnrollProgram';
import { PROGRAM_MUTATION_ERROR_MESSAGE } from './useProgramMutationErrorHandler';

const RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/enroll_in_program`;

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

describe('useEnrollProgram', () => {
  beforeEach(() => showToast.mockClear());

  it('calls the enroll_in_program RPC and resolves with the new enrollment id', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json('new-user-program-id');
      }),
    );

    const { result } = renderHook(() => useEnrollProgram(), {
      wrapper: makeWrapper(),
    });

    const enrolled = await result.current.mutateAsync({
      programId: 'program-abc',
    });

    expect(enrolled).toBe('new-user-program-id');
    expect(receivedBody).toEqual({ p_program_id: 'program-abc' });
  });

  it('passes p_queue when queueing instead of starting', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json('queued-user-program-id');
      }),
    );

    const { result } = renderHook(() => useEnrollProgram(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ programId: 'program-abc', queue: true });

    expect(receivedBody).toEqual({
      p_program_id: 'program-abc',
      p_queue: true,
    });
  });

  it('passes mixed left/right shared weights through to the RPC', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json('new-user-program-id');
      }),
    );

    const { result } = renderHook(() => useEnrollProgram(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      programId: 'program-abc',
      sharedWeightOneValue: 20,
      sharedWeightOneUnit: 'kilograms',
      sharedWeightTwoValue: 16,
      sharedWeightTwoUnit: 'kilograms',
    });

    expect(receivedBody).toEqual({
      p_program_id: 'program-abc',
      p_shared_weight_one_value: 20,
      p_shared_weight_one_unit: 'kilograms',
      p_shared_weight_two_value: 16,
      p_shared_weight_two_unit: 'kilograms',
    });
  });

  it('omits weight two when enrolling with a single two-hand weight', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json('new-user-program-id');
      }),
    );

    const { result } = renderHook(() => useEnrollProgram(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      programId: 'program-abc',
      sharedWeightOneValue: 24,
      sharedWeightOneUnit: 'pounds',
      sharedWeightTwoValue: null,
      sharedWeightTwoUnit: null,
    });

    // null value+unit are dropped from the JSON body, so the RPC receives its
    // NULL defaults for weight two (two-hand loading).
    expect(receivedBody).toEqual({
      p_program_id: 'program-abc',
      p_shared_weight_one_value: 24,
      p_shared_weight_one_unit: 'pounds',
    });
  });

  it('passes per-movement weights through as p_movement_weights', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json('new-user-program-id');
      }),
    );

    const { result } = renderHook(() => useEnrollProgram(), {
      wrapper: makeWrapper(),
    });

    const movementWeights = [
      {
        movementName: 'Kettlebell Swing',
        weightOneValue: 32,
        weightOneUnit: 'kilograms' as const,
        weightTwoValue: null,
        weightTwoUnit: null,
      },
    ];

    await result.current.mutateAsync({
      programId: 'program-abc',
      movementWeights,
    });

    expect(receivedBody).toEqual({
      p_program_id: 'program-abc',
      p_movement_weights: movementWeights,
    });
  });

  it('omits p_movement_weights when the array is empty', async () => {
    let receivedBody: unknown;
    server.use(
      http.post(RPC_URL, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json('new-user-program-id');
      }),
    );

    const { result } = renderHook(() => useEnrollProgram(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({
      programId: 'program-abc',
      movementWeights: [],
    });

    expect(receivedBody).toEqual({ p_program_id: 'program-abc' });
  });

  it('surfaces RPC errors', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useEnrollProgram(), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({ programId: 'program-abc' }),
    ).rejects.toBeTruthy();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(showToast).toHaveBeenCalledWith(PROGRAM_MUTATION_ERROR_MESSAGE, {
      variant: 'destructive',
    });
  });

  it('does not toast on the happy path', async () => {
    server.use(
      http.post(RPC_URL, () => HttpResponse.json('new-user-program-id')),
    );

    const { result } = renderHook(() => useEnrollProgram(), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ programId: 'program-abc' });

    expect(showToast).not.toHaveBeenCalled();
  });
});
