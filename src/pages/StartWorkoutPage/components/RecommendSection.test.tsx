import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { EntitlementContext, EntitlementContextValue } from '~/contexts';
import { VITE_SUPABASE_URL } from '~/env';
import {
  ExampleProgramRecommendation,
  ExampleRecommendation,
} from '~/examples';
import { server } from '~/mocks/server';
import type { Program } from '~/types';

import { RecommendSection, RecommendSectionProps } from './RecommendSection';

const SESSION_URL = `${VITE_SUPABASE_URL}/functions/v1/recommend-session`;
const PROGRAM_URL = `${VITE_SUPABASE_URL}/functions/v1/recommend-program`;

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

const easyStrength = {
  id: 'program-easy-strength',
  title: 'Easy Strength',
} as Program;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderSection({
  entitlement = premium,
  onAcceptSession = vi.fn(),
  onEnrollNow = vi.fn(),
  onQueue = vi.fn(),
  ...props
}: Partial<RecommendSectionProps> & {
  entitlement?: EntitlementContextValue;
} = {}) {
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <EntitlementContext.Provider value={entitlement}>
          <RecommendSection
            onAcceptSession={onAcceptSession}
            showPrograms
            programs={[easyStrength]}
            slotsFull={false}
            onEnrollNow={onEnrollNow}
            onQueue={onQueue}
            {...props}
          />
        </EntitlementContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onAcceptSession, onEnrollNow, onQueue };
}

const recommendSessionButton = () =>
  screen.getByRole('button', { name: /recommend my next session/i });

const switchToProgram = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('tab', { name: /^program$/i }));

const respondWithProgram = (
  recommendation: ExampleProgramRecommendation,
) =>
  server.use(
    http.post(PROGRAM_URL, () =>
      HttpResponse.json({ id: 'rec-1', recommendation }),
    ),
  );

describe('RecommendSection — session scope', () => {
  test('free user sees the preview modal and never calls the function', async () => {
    let calls = 0;
    server.use(
      http.post(SESSION_URL, () => {
        calls += 1;
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    renderSection({ entitlement: base });
    await userEvent.click(recommendSessionButton());

    expect(
      await screen.findByText(/AI session recommendations/i),
    ).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  test('premium user fetches, renders the card, and Accept hands up the recommendation', async () => {
    server.use(
      http.post(SESSION_URL, () =>
        HttpResponse.json(
          { id: 'rec-1', recommendation: new ExampleRecommendation() },
          { status: 200 },
        ),
      ),
    );

    const onAcceptSession = vi.fn();
    renderSection({ onAcceptSession });
    await userEvent.click(recommendSessionButton());

    expect(await screen.findByText('Your AI session')).toBeInTheDocument();
    expect(screen.getByText('Two-Hand Swing')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^accept$/i }));

    expect(onAcceptSession).toHaveBeenCalledTimes(1);
    expect(onAcceptSession.mock.calls[0][0].blocks).toHaveLength(2);
    // Card is dismissed; the entry button returns.
    expect(await screen.findByText(/recommend my next session/i)).toBeVisible();
  });

  test('shows a friendly message when the user has no movements (422)', async () => {
    server.use(
      http.post(SESSION_URL, () =>
        HttpResponse.json({ error: 'no_movements' }, { status: 422 }),
      ),
    );

    renderSection();
    await userEvent.click(recommendSessionButton());

    expect(
      await screen.findByText(/add a few movements to your library first/i),
    ).toBeInTheDocument();
  });

  test('request body carries client_today and no mode', async () => {
    let requestBody: Record<string, unknown> | null = null;
    server.use(
      http.post(SESSION_URL, async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: 'rec-1', recommendation: new ExampleRecommendation() },
          { status: 200 },
        );
      }),
    );

    renderSection();
    await userEvent.click(recommendSessionButton());

    expect(await screen.findByText('Your AI session')).toBeInTheDocument();
    expect(requestBody).toHaveProperty('client_today');
    expect(requestBody).not.toHaveProperty('mode');
  });
});

describe('RecommendSection — program scope', () => {
  test('showPrograms=false hides the scope toggle entirely', () => {
    renderSection({ showPrograms: false });
    expect(
      screen.queryByRole('tab', { name: /^program$/i }),
    ).not.toBeInTheDocument();
    expect(recommendSessionButton()).toBeInTheDocument();
  });

  test('free users get the program preview dialog, not a function call', async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.post(PROGRAM_URL, () => {
        calls += 1;
        return HttpResponse.json({}, { status: 200 });
      }),
    );
    renderSection({ entitlement: base });

    await switchToProgram(user);
    await user.click(
      screen.getByRole('button', { name: /recommend a program/i }),
    );

    expect(
      screen.getByRole('heading', { name: 'AI program recommendations' }),
    ).toBeInTheDocument();
    expect(calls).toBe(0);
  });

  test('a concurrent-mode pick starts now when a slot is free', async () => {
    const user = userEvent.setup();
    respondWithProgram(
      new ExampleProgramRecommendation({
        program_id: easyStrength.id,
        mode: 'concurrent',
      }),
    );
    const { onQueue, onEnrollNow } = renderSection();

    await switchToProgram(user);
    await user.click(
      screen.getByRole('button', { name: /recommend a program/i }),
    );
    await user.click(await screen.findByRole('button', { name: 'Start now' }));

    expect(onEnrollNow).toHaveBeenCalledWith(easyStrength.id);
    expect(onQueue).not.toHaveBeenCalled();
  });

  test('a concurrent-mode pick degrades to queue once every slot is taken', async () => {
    const user = userEvent.setup();
    respondWithProgram(
      new ExampleProgramRecommendation({
        program_id: easyStrength.id,
        mode: 'concurrent',
      }),
    );
    const { onQueue, onEnrollNow } = renderSection({ slotsFull: true });

    await switchToProgram(user);
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
      http.post(PROGRAM_URL, () =>
        HttpResponse.json({ error: 'no_candidates' }, { status: 422 }),
      ),
    );
    renderSection();

    await switchToProgram(user);
    await user.click(
      screen.getByRole('button', { name: /recommend a program/i }),
    );

    expect(
      await screen.findByText(/already running or have queued/i),
    ).toBeInTheDocument();
  });

  test('toggling scope keeps a fetched session recommendation', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(SESSION_URL, () =>
        HttpResponse.json(
          { id: 'rec-1', recommendation: new ExampleRecommendation() },
          { status: 200 },
        ),
      ),
    );

    renderSection();
    await user.click(recommendSessionButton());
    expect(await screen.findByText('Your AI session')).toBeInTheDocument();

    await switchToProgram(user);
    expect(
      screen.getByRole('button', { name: /recommend a program/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^session$/i }));
    expect(screen.getByText('Your AI session')).toBeInTheDocument();
  });
});
