import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';

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
];

const session = { user: { id: 'user-id' } } as never;

const patchRequests: { url: URL; body: unknown }[] = [];

const renderPanel = () => {
  patchRequests.length = 0;

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
  );

  return render(
    <QueryClientProvider client={new QueryClient()}>
      <SessionProvider.Provider value={session}>
        <CustomMovementsPanel />
      </SessionProvider.Provider>
    </QueryClientProvider>,
  );
};

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

  test('offers a one-click link to the suggested catalog match', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(
      await screen.findByRole('button', {
        name: 'Link to Kettlebell Clean and Press',
      }),
    );

    await waitFor(() => expect(patchRequests).toHaveLength(1));
    expect(patchRequests[0].body).toEqual({
      functional_movement_id: 'catalog-1',
    });
    expect(patchRequests[0].url.searchParams.get('id')).toBe('eq.user-1');
  });

  test('falls back to catalog search when there is no confident suggestion', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(
      await screen.findByRole('button', { name: 'Find a match' }),
    );
    await user.type(
      screen.getByLabelText('Search catalog for Bottoms Up Carry'),
      'swing',
    );
    await user.click(screen.getByRole('button', { name: 'Kettlebell Swing' }));

    await waitFor(() => expect(patchRequests).toHaveLength(1));
    expect(patchRequests[0].body).toEqual({
      functional_movement_id: 'catalog-2',
    });
    expect(patchRequests[0].url.searchParams.get('id')).toBe('eq.user-3');
  });
});
