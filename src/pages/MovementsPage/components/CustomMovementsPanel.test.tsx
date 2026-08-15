import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router-dom';

import { SessionProvider } from '~/contexts';
import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { CustomMovementsPanel } from './CustomMovementsPanel';

const CATALOG_ROWS = [
  { id: 'catalog-1', name: 'Kettlebell Clean and Press' },
  { id: 'catalog-2', name: 'Kettlebell Swing' },
  { id: 'catalog-3', name: 'Goblet Squat' },
];

const USER_MOVEMENT_ROWS = [
  {
    id: 'user-1',
    canonical_name: 'Clean and Press',
    functional_movement_id: null,
    movement_logs: [{ count: 4 }],
  },
  {
    id: 'user-2',
    canonical_name: 'Kettlebell Swing',
    functional_movement_id: 'catalog-2',
    movement_logs: [{ count: 9 }],
  },
  {
    id: 'user-3',
    canonical_name: 'Bottoms Up Carry',
    functional_movement_id: null,
    movement_logs: [{ count: 1 }],
  },
  {
    id: 'user-4',
    canonical_name: 'Kettlebel Swng',
    functional_movement_id: null,
    movement_logs: [{ count: 0 }],
  },
];

const MOVEMENT_LOG_ROWS = [
  {
    id: 11,
    rep_scheme: [5, 5],
    timed_rungs: false,
    workout_log_id: 42,
    weight_one_unit: 'kg',
    weight_one_value: 16,
    weight_two_unit: null,
    weight_two_value: null,
    workout_logs: {
      started_at: '2026-08-01T12:00:00Z',
      title: 'Morning Session',
      rpe: null,
    },
  },
];

const session = { user: { id: 'user-id' } } as never;

const patchRequests: { url: URL; body: unknown }[] = [];
const deleteRequests: URL[] = [];

const renderPanel = () => {
  patchRequests.length = 0;
  deleteRequests.length = 0;

  server.use(
    http.get(`${VITE_SUPABASE_URL}/rest/v1/movements_catalog`, () =>
      HttpResponse.json(CATALOG_ROWS),
    ),
    http.get(`${VITE_SUPABASE_URL}/rest/v1/user_movements`, () =>
      HttpResponse.json(USER_MOVEMENT_ROWS),
    ),
    http.patch(
      `${VITE_SUPABASE_URL}/rest/v1/user_movements`,
      async ({ request }) => {
        patchRequests.push({
          url: new URL(request.url),
          body: await request.json(),
        });
        return HttpResponse.json([]);
      },
    ),
    http.delete(
      `${VITE_SUPABASE_URL}/rest/v1/user_movements`,
      ({ request }) => {
        deleteRequests.push(new URL(request.url));
        return HttpResponse.json([]);
      },
    ),
    http.get(`${VITE_SUPABASE_URL}/rest/v1/movement_logs`, () =>
      HttpResponse.json(MOVEMENT_LOG_ROWS),
    ),
  );

  return render(
    <QueryClientProvider client={new QueryClient()}>
      <SessionProvider.Provider value={session}>
        <MemoryRouter>
          <CustomMovementsPanel />
        </MemoryRouter>
      </SessionProvider.Provider>
    </QueryClientProvider>,
  );
};

const openOverflowMenu = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) =>
  user.click(
    await screen.findByRole('button', { name: `More actions for ${name}` }),
  );

describe('custom movements panel', () => {
  test('lists only unlinked user movements', async () => {
    renderPanel();

    expect(await screen.findByText('Clean and Press')).toBeInTheDocument();
    expect(screen.getByText('Bottoms Up Carry')).toBeInTheDocument();
    expect(screen.queryByText('Kettlebell Swing')).not.toBeInTheDocument();
  });

  test('shows the log count so history at stake is visible', async () => {
    renderPanel();

    expect(await screen.findByText('4 logs')).toBeInTheDocument();
    expect(screen.getByText('1 log')).toBeInTheDocument();
  });

  test('the dialog links to the suggested catalog match', async () => {
    const user = userEvent.setup();
    renderPanel();

    const [firstLink] = await screen.findAllByRole('button', { name: 'Link' });
    await user.click(firstLink);

    expect(
      await screen.findByText('Link “Clean and Press”'),
    ).toBeInTheDocument();
    expect(screen.getByText('Kettlebell Clean and Press')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Link' }).at(-1)!);

    await waitFor(() => expect(patchRequests).toHaveLength(1));
    expect(patchRequests[0].body).toEqual({
      functional_movement_id: 'catalog-1',
    });
    expect(patchRequests[0].url.searchParams.get('id')).toBe('eq.user-1');
  });

  test('the dialog falls back to catalog search when there is no confident suggestion', async () => {
    const user = userEvent.setup();
    renderPanel();

    const links = await screen.findAllByRole('button', { name: 'Link' });
    await user.click(links[1]);

    expect(
      await screen.findByText('Link “Bottoms Up Carry”'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Find a movement')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Find a movement'), 'swing');
    await user.click(screen.getByRole('button', { name: 'Kettlebell Swing' }));

    await waitFor(() => expect(patchRequests).toHaveLength(1));
    expect(patchRequests[0].body).toEqual({
      functional_movement_id: 'catalog-2',
    });
    expect(patchRequests[0].url.searchParams.get('id')).toBe('eq.user-3');
  });

  test('the dialog reports how much history the link carries over', async () => {
    const user = userEvent.setup();
    renderPanel();

    const [firstLink] = await screen.findAllByRole('button', { name: 'Link' });
    await user.click(firstLink);

    expect(
      await screen.findByText(/Your 4 logs stay attached/),
    ).toBeInTheDocument();
  });

  test('deleting is offered only for movements with no logs', async () => {
    const user = userEvent.setup();
    renderPanel();

    await openOverflowMenu(user, 'Clean and Press');
    expect(
      await screen.findByRole('menuitem', { name: 'Delete movement' }),
    ).toHaveAttribute('aria-disabled', 'true');

    await user.keyboard('{Escape}');

    await openOverflowMenu(user, 'Kettlebel Swng');
    expect(
      await screen.findByRole('menuitem', { name: 'Delete movement' }),
    ).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('confirming the delete removes the custom movement', async () => {
    const user = userEvent.setup();
    renderPanel();

    await openOverflowMenu(user, 'Kettlebel Swng');
    await user.click(
      await screen.findByRole('menuitem', { name: 'Delete movement' }),
    );

    expect(await screen.findByText('Delete movement?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete movement' }));

    await waitFor(() => expect(deleteRequests).toHaveLength(1));
    expect(deleteRequests[0].searchParams.get('id')).toBe('eq.user-4');
  });

  test('viewing logs lists the sessions the movement appears in', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole('button', { name: '4 logs' }));

    expect(
      await screen.findByText('Logs for “Clean and Press”'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Morning Session')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Morning Session/ }),
    ).toHaveAttribute('href', '/history/42');
  });
});
