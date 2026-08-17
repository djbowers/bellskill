import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { ThreadMenu } from './ThreadMenu';

const THREADS = `${VITE_SUPABASE_URL}/rest/v1/chalk_threads`;

vi.mock('~/contexts', async () => ({
  ...(await vi.importActual<typeof import('~/contexts')>('~/contexts')),
  useSession: () => ({ user: { id: 'user-1' } }),
}));

// `title` is checked with `in` rather than `??` so an explicit null (an
// untitled thread) is distinguishable from "not supplied".
const thread = (over: { id: string; title?: string | null }) => ({
  id: over.id,
  title: 'title' in over ? over.title : `Conversation ${over.id}`,
  created_at: '2026-08-15T00:00:00Z',
  last_message_at: '2026-08-15T00:00:00Z',
});

const onSelectThread = vi.fn();
const onNewThread = vi.fn();

const renderMenu = (currentThreadId: string | null = null) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThreadMenu
        currentThreadId={currentThreadId}
        onSelectThread={onSelectThread}
        onNewThread={onNewThread}
      />
    </QueryClientProvider>,
  );
};

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Conversations' }));
};

beforeEach(() => {
  onSelectThread.mockReset();
  onNewThread.mockReset();
  server.use(
    http.get(THREADS, () =>
      HttpResponse.json([thread({ id: 't1' }), thread({ id: 't2' })]),
    ),
  );
});

describe('ThreadMenu', () => {
  test('does not fetch the list until it is opened', async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.get(THREADS, () => {
        calls += 1;
        return HttpResponse.json([thread({ id: 't1' })]);
      }),
    );

    renderMenu();
    expect(calls).toBe(0);

    await openMenu(user);
    await waitFor(() => expect(calls).toBe(1));
  });

  test('lists conversations and selects one', async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);

    await user.click(await screen.findByText('Conversation t2'));

    expect(onSelectThread).toHaveBeenCalledWith('t2');
  });

  test('starts a new conversation', async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);

    await user.click(
      await screen.findByRole('button', { name: /new conversation/i }),
    );

    expect(onNewThread).toHaveBeenCalled();
  });

  test('falls back to a readable label for an untitled thread', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(THREADS, () =>
        HttpResponse.json([thread({ id: 't1', title: null })]),
      ),
    );

    renderMenu();
    await openMenu(user);

    expect(await screen.findByText('Untitled conversation')).toBeInTheDocument();
  });

  test('says so when there are no past conversations', async () => {
    const user = userEvent.setup();
    server.use(http.get(THREADS, () => HttpResponse.json([])));

    renderMenu();
    await openMenu(user);

    expect(
      await screen.findByText(/no past conversations yet/i),
    ).toBeInTheDocument();
  });
});

describe('ThreadMenu — deleting', () => {
  test('asks before deleting, and does nothing if dismissed', async () => {
    const user = userEvent.setup();
    let deleted = false;
    server.use(
      http.delete(THREADS, () => {
        deleted = true;
        return HttpResponse.json([]);
      }),
    );

    renderMenu();
    await openMenu(user);
    await user.click(
      await screen.findByRole('button', { name: 'Delete Conversation t1' }),
    );

    expect(
      await screen.findByText(/delete this conversation\?/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(deleted).toBe(false);
  });

  test('deletes on confirm', async () => {
    const user = userEvent.setup();
    let deletedQuery: string | null = null;
    server.use(
      http.delete(THREADS, ({ request }) => {
        deletedQuery = new URL(request.url).search;
        return HttpResponse.json([]);
      }),
    );

    renderMenu();
    await openMenu(user);
    await user.click(
      await screen.findByRole('button', { name: 'Delete Conversation t1' }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // RLS scopes the delete to the caller; the id is the only filter needed.
    await waitFor(() => expect(deletedQuery).toContain('t1'));
  });

  test('deleting the open conversation resets to a new one', async () => {
    const user = userEvent.setup();
    server.use(http.delete(THREADS, () => HttpResponse.json([])));

    renderMenu('t1');
    await openMenu(user);
    await user.click(
      await screen.findByRole('button', { name: 'Delete Conversation t1' }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // Otherwise the page would keep rendering a thread that no longer exists.
    await waitFor(() => expect(onNewThread).toHaveBeenCalled());
  });

  test('deleting a different conversation leaves the open one alone', async () => {
    const user = userEvent.setup();
    server.use(http.delete(THREADS, () => HttpResponse.json([])));

    renderMenu('t1');
    await openMenu(user);
    await user.click(
      await screen.findByRole('button', { name: 'Delete Conversation t2' }),
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(
        screen.queryByText(/delete this conversation\?/i),
      ).not.toBeInTheDocument(),
    );
    expect(onNewThread).not.toHaveBeenCalled();
  });
});
