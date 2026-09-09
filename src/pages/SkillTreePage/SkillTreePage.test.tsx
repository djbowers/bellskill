import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router-dom';

import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { SkillTreePage } from './SkillTreePage';

vi.mock('~/contexts', async () => {
  const actual =
    await vi.importActual<typeof import('~/contexts')>('~/contexts');
  return { ...actual, useSession: () => ({ user: { id: 'user-123' } }) };
});

const PROGRESS_URL = `${VITE_SUPABASE_URL}/rest/v1/skill_node_progress`;

let upsertedBodies: Record<string, unknown>[] = [];
let deletedQueries: string[] = [];

const renderPage = (rows: unknown[]) => {
  upsertedBodies = [];
  deletedQueries = [];

  server.use(
    http.get(PROGRESS_URL, () => HttpResponse.json(rows)),
    http.post(PROGRESS_URL, async ({ request }) => {
      upsertedBodies.push((await request.json()) as Record<string, unknown>);
      return new HttpResponse(null, { status: 201 });
    }),
    http.delete(PROGRESS_URL, ({ request }) => {
      deletedQueries.push(new URL(request.url).search);
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <SkillTreePage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

const card = (title: string) =>
  screen.getByRole('button', { name: new RegExp(`^${title},`) });

describe('skill tree page', () => {
  test('renders nine levels with no progress', async () => {
    renderPage([]);

    expect(
      await screen.findByRole('heading', { name: 'Level 1 · Foundation' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Level 9 · Elite' })).toBeInTheDocument();
    expect(screen.getByText('0 of 6 nodes complete')).toBeInTheDocument();
    expect(card('Breathing & bracing')).toHaveAttribute('data-state', 'available');
    expect(card('Deadbug')).toHaveAttribute('data-state', 'locked');
  });

  test('reflects persisted progress in card states and level counts', async () => {
    renderPage([
      { node_id: 'L1-N1', status: 'complete', completed_at: '2026-09-01T00:00:00Z' },
      { node_id: 'L1-N2', status: 'active', completed_at: null },
    ]);

    expect(await screen.findByText('1 of 6 nodes complete')).toBeInTheDocument();
    expect(card('Breathing & bracing')).toHaveAttribute('data-state', 'complete');
    expect(card('Hip hinge pattern')).toHaveAttribute('data-state', 'active');
    expect(card('Deadbug')).toHaveAttribute('data-state', 'available');
    expect(card('Goblet squat')).toHaveAttribute('data-state', 'available');
  });

  test('opens a node dialog with skills, prerequisites, and benchmark', async () => {
    const user = userEvent.setup();
    renderPage([]);
    await screen.findByText('0 of 6 nodes complete');

    await user.click(card('Deadbug'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Deadbug' })).toBeInTheDocument();
    expect(within(dialog).getByText('Lumbar spine imprint')).toBeInTheDocument();
    expect(within(dialog).getByText('Breathing & bracing')).toBeInTheDocument();
    expect(within(dialog).getByText(/zero lumbar lift-off/)).toBeInTheDocument();
  });

  test('starting a locked node is advised against but never blocked', async () => {
    const user = userEvent.setup();
    renderPage([]);
    await screen.findByText('0 of 6 nodes complete');

    await user.click(card('Deadbug'));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(/prerequisites not complete: Breathing & bracing/),
    ).toBeInTheDocument();

    const start = within(dialog).getByRole('button', { name: 'Start practicing' });
    expect(start).toBeEnabled();
    await user.click(start);

    await waitFor(() => expect(upsertedBodies).toHaveLength(1));
    expect(upsertedBodies[0]).toEqual({
      user_id: 'user-123',
      node_id: 'L1-N4',
      status: 'active',
      completed_at: null,
    });
  });

  test('marking a benchmark passed stamps a completion time', async () => {
    const user = userEvent.setup();
    renderPage([{ node_id: 'L1-N1', status: 'active', completed_at: null }]);
    await screen.findByText('0 of 6 nodes complete');

    await user.click(card('Breathing & bracing'));
    await user.click(screen.getByRole('button', { name: 'Mark benchmark passed' }));

    await waitFor(() => expect(upsertedBodies).toHaveLength(1));
    expect(upsertedBodies[0]).toMatchObject({
      user_id: 'user-123',
      node_id: 'L1-N1',
      status: 'complete',
    });
    expect(typeof upsertedBodies[0].completed_at).toBe('string');
  });

  test('undo removes the progress row for that node', async () => {
    const user = userEvent.setup();
    renderPage([
      { node_id: 'L1-N1', status: 'complete', completed_at: '2026-09-01T00:00:00Z' },
    ]);
    await screen.findByText('1 of 6 nodes complete');

    await user.click(card('Breathing & bracing'));
    expect(screen.getByText(/^Passed /)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    await waitFor(() => expect(deletedQueries).toHaveLength(1));
    expect(deletedQueries[0]).toContain('user_id=eq.user-123');
    expect(deletedQueries[0]).toContain('node_id=eq.L1-N1');
  });
});
