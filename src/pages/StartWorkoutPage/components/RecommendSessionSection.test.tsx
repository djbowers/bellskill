import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { EntitlementContext, EntitlementContextValue } from '~/contexts';
import { VITE_SUPABASE_URL } from '~/env';
import { ExampleRecommendation } from '~/examples';
import { server } from '~/mocks/server';

import { RecommendSessionSection } from './RecommendSessionSection';

const FUNCTION_URL = `${VITE_SUPABASE_URL}/functions/v1/recommend-session`;

const base: EntitlementContextValue = {
  isPremium: false,
  isTrialing: false,
  trialExpired: false,
  trialDaysRemaining: null,
  effectiveAccess: 'free',
  isLoading: false,
  refetch: () => {},
};

const premium: EntitlementContextValue = {
  ...base,
  isPremium: true,
  effectiveAccess: 'premium',
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderSection(
  entitlement: EntitlementContextValue,
  onAccept = vi.fn(),
  initialMode?: 'default' | 'balance',
) {
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <EntitlementContext.Provider value={entitlement}>
          <RecommendSessionSection
            onAccept={onAccept}
            initialMode={initialMode}
          />
        </EntitlementContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onAccept };
}

const recommendButton = () =>
  screen.getByRole('button', { name: /recommend my next session/i });

describe('RecommendSessionSection', () => {
  test('free user sees the preview modal and never calls the function', async () => {
    let calls = 0;
    server.use(
      http.post(FUNCTION_URL, () => {
        calls += 1;
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    renderSection(base);
    await userEvent.click(recommendButton());

    expect(
      await screen.findByText(/AI session recommendations/i),
    ).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  test('premium user fetches, renders the card, and Accept hands up the recommendation', async () => {
    server.use(
      http.post(FUNCTION_URL, () =>
        HttpResponse.json(
          { id: 'rec-1', recommendation: new ExampleRecommendation() },
          { status: 200 },
        ),
      ),
    );

    const { onAccept } = renderSection(premium);
    await userEvent.click(recommendButton());

    expect(await screen.findByText('Your AI session')).toBeInTheDocument();
    expect(screen.getByText('Two-Hand Swing')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^accept$/i }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onAccept.mock.calls[0][0].blocks).toHaveLength(2);
    // Card is dismissed; the entry button returns.
    expect(await screen.findByText(/recommend my next session/i)).toBeVisible();
  });

  test('shows a friendly message when the user has no movements (422)', async () => {
    server.use(
      http.post(FUNCTION_URL, () =>
        HttpResponse.json({ error: 'no_movements' }, { status: 422 }),
      ),
    );

    renderSection(premium);
    await userEvent.click(recommendButton());

    expect(
      await screen.findByText(/add a few movements to your library first/i),
    ).toBeInTheDocument();
  });

  test('Balance focus toggle sends mode=balance to the function', async () => {
    let requestBody: Record<string, unknown> | null = null;
    server.use(
      http.post(FUNCTION_URL, async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: 'rec-1', recommendation: new ExampleRecommendation() },
          { status: 200 },
        );
      }),
    );

    renderSection(premium);
    await userEvent.click(screen.getByRole('tab', { name: /balance focus/i }));
    await userEvent.click(
      screen.getByRole('button', { name: /balance me out/i }),
    );

    expect(await screen.findByText('Your AI session')).toBeInTheDocument();
    expect(requestBody).toMatchObject({ mode: 'balance' });
  });

  test('default mode sends mode=default and keeps the original CTA label', async () => {
    let requestBody: Record<string, unknown> | null = null;
    server.use(
      http.post(FUNCTION_URL, async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: 'rec-1', recommendation: new ExampleRecommendation() },
          { status: 200 },
        );
      }),
    );

    renderSection(premium);
    await userEvent.click(recommendButton());

    expect(await screen.findByText('Your AI session')).toBeInTheDocument();
    expect(requestBody).toMatchObject({ mode: 'default' });
  });

  test('initialMode="balance" preselects the toggle (Weekly Balance CTA path)', () => {
    renderSection(premium, vi.fn(), 'balance');
    expect(
      screen.getByRole('tab', { name: /balance focus/i }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('button', { name: /balance me out/i }),
    ).toBeInTheDocument();
  });

  test('free user tapping Balance me out gets the preview modal, no call', async () => {
    let calls = 0;
    server.use(
      http.post(FUNCTION_URL, () => {
        calls += 1;
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    renderSection(base, vi.fn(), 'balance');
    await userEvent.click(
      screen.getByRole('button', { name: /balance me out/i }),
    );

    expect(
      await screen.findByText(/AI session recommendations/i),
    ).toBeInTheDocument();
    expect(calls).toBe(0);
  });
});
