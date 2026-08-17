import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { ChalkPage } from './ChalkPage';

const FN = `${VITE_SUPABASE_URL}/functions/v1/chalk-chat`;
const MESSAGES = `${VITE_SUPABASE_URL}/rest/v1/chalk_messages`;

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )),
  useNavigate: () => mockNavigate,
}));

const mockEntitlement = vi.fn();
vi.mock('~/contexts', async () => ({
  ...(await vi.importActual<typeof import('~/contexts')>('~/contexts')),
  useEntitlement: () => mockEntitlement(),
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/chalk']}>
        <ChalkPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const premium = () =>
  mockEntitlement.mockReturnValue({
    effectiveAccess: 'premium',
    isLoading: false,
  });

beforeEach(() => {
  mockNavigate.mockReset();
  mockEntitlement.mockReset();
  premium();
});

describe('ChalkPage — gating', () => {
  test('a free user sees the locked treatment, not the composer', () => {
    mockEntitlement.mockReturnValue({
      effectiveAccess: 'free',
      isLoading: false,
    });
    renderPage();

    expect(screen.getByText('Premium feature')).toBeInTheDocument();
    expect(screen.queryByLabelText('Message Chalk')).not.toBeInTheDocument();
  });
});

describe('ChalkPage — empty state', () => {
  test('offers starter prompts and a medical disclaimer', () => {
    renderPage();

    expect(screen.getByText('Ask Chalk')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Which patterns am I neglecting?' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/not medical advice/i)).toBeInTheDocument();
  });

  test('tapping a starter sends it', async () => {
    const user = userEvent.setup();
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.post(FN, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          thread_id: 't1',
          user_message_id: 'u1',
          assistant_message_id: 'a1',
          reply: 'Your hinge needs attention.',
        });
      }),
    );

    renderPage();
    await user.click(
      screen.getByRole('button', { name: 'What should I train today?' }),
    );

    await waitFor(() =>
      expect(sent).toMatchObject({ message: 'What should I train today?' }),
    );
  });
});

describe('ChalkPage — sending', () => {
  test('shows the message immediately, then the persisted reply', async () => {
    const user = userEvent.setup();

    server.use(
      http.post(FN, () =>
        HttpResponse.json({
          thread_id: 't1',
          user_message_id: 'u1',
          assistant_message_id: 'a1',
          reply: 'Swings would be a good call.',
        }),
      ),
      // After the turn the hook invalidates and the server becomes the truth.
      http.get(MESSAGES, () =>
        HttpResponse.json([
          {
            id: 'u1',
            thread_id: 't1',
            role: 'user',
            content: 'what now?',
            status: 'complete',
            error: null,
            created_at: '2026-08-15T00:00:00Z',
          },
          {
            id: 'a1',
            thread_id: 't1',
            role: 'assistant',
            content: 'Swings would be a good call.',
            status: 'complete',
            error: null,
            created_at: '2026-08-15T00:00:01Z',
          },
        ]),
      ),
    );

    renderPage();
    await user.type(screen.getByLabelText('Message Chalk'), 'what now?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    // Optimistic bubble lands before the network settles.
    expect(await screen.findByText('what now?')).toBeInTheDocument();
    expect(
      await screen.findByText('Swings would be a good call.'),
    ).toBeInTheDocument();
  });
});

describe('ChalkPage — errors', () => {
  test('a generation failure explains itself and offers Retry', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(FN, () =>
        HttpResponse.json({ error: 'chalk_failed' }, { status: 502 }),
      ),
    );

    renderPage();
    await user.type(screen.getByLabelText('Message Chalk'), 'hi');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(/couldn’t answer that one/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    // The typed message is still on screen — nothing the lifter wrote is lost.
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  test('a retry after a failure continues the same thread', async () => {
    const user = userEvent.setup();
    const sent: Array<Record<string, unknown>> = [];
    server.use(
      http.post(FN, async ({ request }) => {
        sent.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          { error: 'chalk_failed', thread_id: 't-created' },
          { status: 502 },
        );
      }),
    );

    renderPage();
    await user.type(screen.getByLabelText('Message Chalk'), 'hi');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    // The first turn had no thread; the retry must reuse the one the failed
    // turn created rather than opening a second conversation.
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[0].thread_id).toBeNull();
    expect(sent[1].thread_id).toBe('t-created');
  });

  test('the daily cap gets its own copy rather than a generic error', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(FN, () =>
        HttpResponse.json({ error: 'rate_limited', cap: 50 }, { status: 429 }),
      ),
    );

    renderPage();
    await user.type(screen.getByLabelText('Message Chalk'), 'hi');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(
      await screen.findByText(/today's message limit/i),
    ).toBeInTheDocument();
  });

  test('a lapsed trial mid-session routes to the paywall', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(FN, () =>
        HttpResponse.json(
          { error: 'premium_required', paywall_trigger: true },
          { status: 401 },
        ),
      ),
    );

    renderPage();
    await user.type(screen.getByLabelText('Message Chalk'), 'hi');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/paywall'));
  });
});

describe('ChalkPage — composer', () => {
  test('Send is disabled until there is something to send', async () => {
    const user = userEvent.setup();
    renderPage();

    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();

    await user.type(screen.getByLabelText('Message Chalk'), 'hi');
    expect(send).toBeEnabled();
  });

  test('refuses an over-long message client-side', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByLabelText('Message Chalk'));
    await user.paste('x'.repeat(2001));

    expect(screen.getByText(/keep it under 2000/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });
});
