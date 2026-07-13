import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import { SAFE_DEFAULT_FEATURES } from '~/config/experiments';
import { SessionProvider } from '~/contexts';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import { fetchExperimentFeatures, useFeatureFlags } from './useFeatureFlags';

const RPC_URL = `${VITE_SUPABASE_URL}/rest/v1/rpc/evaluate_feature_flags`;

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

describe('fetchExperimentFeatures', () => {
  test('maps treatment variants to true and everything else to false', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json([
          { flag_key: 'curated_first_workout', variant: 'treatment' },
          { flag_key: 'repeat_previous', variant: 'control' },
          { flag_key: 'recommender', variant: 'treatment' },
        ]),
      ),
    );

    await expect(fetchExperimentFeatures()).resolves.toEqual({
      curatedFirstWorkout: true,
      repeatPrevious: false,
      recommender: true,
    });
  });

  test('sticky: the same RPC response resolves to the same variants on repeated evals', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json([
          { flag_key: 'curated_first_workout', variant: 'treatment' },
          { flag_key: 'repeat_previous', variant: 'treatment' },
          { flag_key: 'recommender', variant: 'control' },
        ]),
      ),
    );

    const first = await fetchExperimentFeatures();
    const second = await fetchExperimentFeatures();

    expect(first).toEqual(second);
    expect(first).toEqual({
      curatedFirstWorkout: true,
      repeatPrevious: true,
      recommender: false,
    });
  });

  test('throws on an RPC error so the caller can fall back', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    await expect(fetchExperimentFeatures()).rejects.toBeTruthy();
  });
});

describe('useFeatureFlags', () => {
  test('resolves the mapped variants for a signed-in user', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json([
          { flag_key: 'curated_first_workout', variant: 'treatment' },
          { flag_key: 'repeat_previous', variant: 'control' },
          { flag_key: 'recommender', variant: 'control' },
        ]),
      ),
    );

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: makeWrapper(),
    });

    // Pending while the eval query resolves, then the mapped variants land.
    expect(result.current.isPending).toBe(true);
    await waitFor(() =>
      expect(result.current.features).toEqual({
        curatedFirstWorkout: true,
        repeatPrevious: false,
        recommender: false,
      }),
    );
    expect(result.current.isPending).toBe(false);
  });

  test('falls back to the safe default (control / all off) when the RPC errors', async () => {
    server.use(
      http.post(RPC_URL, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: makeWrapper(),
    });

    // Starts on the safe-default placeholder and stays there after the query
    // terminally errors — never flips a user into treatment on failure. The
    // error path is distinct from loading: it settles with isPending false.
    expect(result.current.features).toEqual(SAFE_DEFAULT_FEATURES);
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.features).toEqual(SAFE_DEFAULT_FEATURES);
  });

  test('resolves to the safe default without calling the RPC when unauthenticated', async () => {
    let called = false;
    server.use(
      http.post(RPC_URL, () => {
        called = true;
        return HttpResponse.json([]);
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useFeatureFlags(), {
      wrapper: ({ children }) =>
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          children,
        ),
    });

    // Unauthenticated resolves immediately to the safe default — not pending.
    expect(result.current.features).toEqual(SAFE_DEFAULT_FEATURES);
    expect(result.current.isPending).toBe(false);
    expect(called).toBe(false);
  });
});
