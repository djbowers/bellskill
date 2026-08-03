import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { EntitlementContext } from '~/contexts';
import type { EntitlementContextValue } from '~/contexts/EntitlementContext';
import { VITE_SUPABASE_URL } from '~/env';
import { ExampleProgramRecommendation } from '~/examples';
import { server } from '~/mocks/server';
import type { Program } from '~/types';

import { RecommendProgramSection } from './RecommendProgramSection';

const FUNCTION_URL = `${VITE_SUPABASE_URL}/functions/v1/recommend-program`;

const premiumEntitlement: EntitlementContextValue = {
  isPremium: true,
  isTrialing: false,
  trialExpired: false,
  trialDaysRemaining: null,
  effectiveAccess: 'premium' as const,
  isLoading: false,
  refetch: () => {},
};

const freeEntitlement = {
  ...premiumEntitlement,
  isPremium: false,
  effectiveAccess: 'free' as const,
};

const easyStrength = {
  id: 'program-easy-strength',
  title: 'Easy Strength',
} as Program;

const renderSection = ({
  entitlement = premiumEntitlement,
  slotsFull = false,
  onEnrollNow = vi.fn(),
  onQueue = vi.fn(),
} = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <EntitlementContext.Provider value={entitlement}>
          <RecommendProgramSection
            programs={[easyStrength]}
            slotsFull={slotsFull}
            onEnrollNow={onEnrollNow}
            onQueue={onQueue}
            userId="user-123"
          />
        </EntitlementContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { onEnrollNow, onQueue };
};

const respondWith = (recommendation: ExampleProgramRecommendation) =>
  server.use(
    http.post(FUNCTION_URL, () =>
      HttpResponse.json({ id: 'rec-1', recommendation }),
    ),
  );

describe('RecommendProgramSection', () => {
  test('free users get the preview dialog, not a function call', async () => {
    const user = userEvent.setup();
    renderSection({ entitlement: freeEntitlement });

    await user.click(
      screen.getByRole('button', { name: /recommend a program/i }),
    );

    expect(
      screen.getByRole('heading', { name: 'AI program recommendations' }),
    ).toBeInTheDocument();
  });

  test('a queue-mode pick shows the card and Add to queue calls onQueue', async () => {
    const user = userEvent.setup();
    respondWith(
      new ExampleProgramRecommendation({
        program_id: easyStrength.id,
        mode: 'queue',
      }),
    );
    const { onQueue, onEnrollNow } = renderSection();

    await user.click(
      screen.getByRole('button', { name: /recommend a program/i }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Easy Strength' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Queue for later')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add to queue' }));
    expect(onQueue).toHaveBeenCalledWith(easyStrength.id);
    expect(onEnrollNow).not.toHaveBeenCalled();
  });

  test('a concurrent-mode pick starts now when a slot is free', async () => {
    const user = userEvent.setup();
    respondWith(
      new ExampleProgramRecommendation({
        program_id: easyStrength.id,
        mode: 'concurrent',
      }),
    );
    const { onQueue, onEnrollNow } = renderSection();

    await user.click(
      screen.getByRole('button', { name: /recommend a program/i }),
    );
    await user.click(await screen.findByRole('button', { name: 'Start now' }));

    expect(onEnrollNow).toHaveBeenCalledWith(easyStrength.id);
    expect(onQueue).not.toHaveBeenCalled();
  });

  test('a concurrent-mode pick degrades to queue once every slot is taken', async () => {
    const user = userEvent.setup();
    respondWith(
      new ExampleProgramRecommendation({
        program_id: easyStrength.id,
        mode: 'concurrent',
      }),
    );
    const { onQueue, onEnrollNow } = renderSection({ slotsFull: true });

    await user.click(
      screen.getByRole('button', { name: /recommend a program/i }),
    );
    await user.click(
      await screen.findByRole('button', { name: 'Add to queue' }),
    );

    expect(onQueue).toHaveBeenCalledWith(easyStrength.id);
    expect(onEnrollNow).not.toHaveBeenCalled();
  });

  test('no_candidates renders its friendly message', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(FUNCTION_URL, () =>
        HttpResponse.json({ error: 'no_candidates' }, { status: 422 }),
      ),
    );
    renderSection();

    await user.click(
      screen.getByRole('button', { name: /recommend a program/i }),
    );

    expect(
      await screen.findByText(/already running or have queued/i),
    ).toBeInTheDocument();
  });
});
