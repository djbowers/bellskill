import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ExampleProgramRecommendation } from '~/examples';
import { server } from '~/mocks/server';

import { VITE_SUPABASE_URL } from '../env';
import {
  RecommendProgramError,
  useRecommendProgram,
} from './useRecommendProgram';

const FUNCTION_URL = `${VITE_SUPABASE_URL}/functions/v1/recommend-program`;

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
};

const mutateAndSettle = async () => {
  const { result } = renderHook(() => useRecommendProgram(), {
    wrapper: makeWrapper(),
  });
  result.current.mutate();
  await waitFor(() =>
    expect(result.current.isSuccess || result.current.isError).toBe(true),
  );
  return result;
};

describe('useRecommendProgram', () => {
  test('resolves the recommendation on success', async () => {
    const recommendation = new ExampleProgramRecommendation();
    server.use(
      http.post(FUNCTION_URL, () =>
        HttpResponse.json({ id: 'rec-1', recommendation }),
      ),
    );

    const result = await mutateAndSettle();

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual({
      id: 'rec-1',
      recommendation: { ...recommendation },
    });
  });

  test.each([
    ['premium_required', { error: 'premium_required', paywall_trigger: true }, 401],
    ['no_candidates', { error: 'no_candidates' }, 422],
    ['recommendation_failed', { error: 'recommendation_failed' }, 502],
  ] as const)(
    'surfaces the %s error code',
    async (code, body, status) => {
      server.use(
        http.post(FUNCTION_URL, () => HttpResponse.json(body, { status })),
      );

      const result = await mutateAndSettle();

      expect(result.current.isError).toBe(true);
      const error = result.current.error;
      expect(error).toBeInstanceOf(RecommendProgramError);
      expect((error as RecommendProgramError).code).toBe(code);
    },
  );

  test('falls back to the unknown code on a non-JSON error body', async () => {
    server.use(
      http.post(
        FUNCTION_URL,
        () => new HttpResponse('boom', { status: 500 }),
      ),
    );

    const result = await mutateAndSettle();

    expect(result.current.isError).toBe(true);
    expect((result.current.error as RecommendProgramError).code).toBe(
      'unknown',
    );
  });
});
