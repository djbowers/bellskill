import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter } from 'react-router-dom';

import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { EquipmentPage } from './EquipmentPage';

vi.mock('~/contexts', async () => {
  const actual =
    await vi.importActual<typeof import('~/contexts')>('~/contexts');
  return { ...actual, useSession: () => ({ user: { id: 'user-123' } }) };
});

const EQUIPMENT_URL = `${VITE_SUPABASE_URL}/rest/v1/user_equipment`;

const fixedBell = {
  id: 'bell-1',
  kind: 'fixed',
  weight: 16,
  min_weight: null,
  max_weight: null,
  step_weight: null,
  unit: 'kilograms',
  quantity: 2,
};

const adjustableBell = {
  id: 'bell-2',
  kind: 'adjustable',
  weight: null,
  min_weight: 12,
  max_weight: 32,
  step_weight: 2,
  unit: 'kilograms',
  quantity: 1,
};

let insertedBodies: unknown[] = [];
let deletedIds: string[] = [];

const renderPage = (rows: unknown[]) => {
  insertedBodies = [];
  deletedIds = [];

  server.use(
    http.get(EQUIPMENT_URL, () => HttpResponse.json(rows)),
    http.post(EQUIPMENT_URL, async ({ request }) => {
      insertedBodies.push(await request.json());
      return new HttpResponse(null, { status: 201 });
    }),
    http.delete(EQUIPMENT_URL, ({ request }) => {
      const id = new URL(request.url).searchParams.get('id');
      if (id) deletedIds.push(id);
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient()}>
        <EquipmentPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
};

describe('equipment page', () => {
  test('lists fixed and adjustable bells with their badges', async () => {
    renderPage([fixedBell, adjustableBell]);

    expect(await screen.findByText('16 kg')).toBeInTheDocument();
    expect(screen.getByText('Pair')).toBeInTheDocument();
    expect(screen.getByText('12–32 kg')).toBeInTheDocument();
    expect(screen.getByText('2 kg steps')).toBeInTheDocument();
    expect(screen.getByText('Fixed bells')).toBeInTheDocument();
    expect(screen.getByText('Adjustable bells')).toBeInTheDocument();
  });

  test('summarizes loadable weights for the recommender', async () => {
    renderPage([fixedBell, adjustableBell]);

    expect(await screen.findByText('Your loadable weights')).toBeInTheDocument();
    expect(screen.getByText(/11 loadable weights/)).toBeInTheDocument();
    expect(
      screen.getByText(/adjustable bell keeps one weight for a whole session/),
    ).toBeInTheDocument();
  });

  test('shows an empty state and no spectrum when nothing is recorded', async () => {
    renderPage([]);

    expect(await screen.findByText(/No equipment yet/)).toBeInTheDocument();
    expect(screen.queryByText('Your loadable weights')).not.toBeInTheDocument();
  });

  test('adds a fixed bell', async () => {
    const user = userEvent.setup();
    renderPage([]);
    await screen.findByText(/No equipment yet/);

    await user.click(screen.getByRole('button', { name: 'Add equipment' }));
    await user.click(screen.getByRole('button', { name: 'Add bell' }));

    await waitFor(() => expect(insertedBodies).toHaveLength(1));
    expect(insertedBodies[0]).toMatchObject({
      user_id: 'user-123',
      kind: 'fixed',
      weight: 16,
      quantity: 1,
      unit: 'kilograms',
    });
  });

  test('switching to adjustable reveals the range fields', async () => {
    const user = userEvent.setup();
    renderPage([]);
    await screen.findByText(/No equipment yet/);

    await user.click(screen.getByRole('button', { name: 'Add equipment' }));
    expect(screen.getByText('Weight')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Adjustable' }));

    expect(screen.getByText('Lightest setting')).toBeInTheDocument();
    expect(screen.getByText('Heaviest setting')).toBeInTheDocument();
    expect(screen.getByText('Adjusts in steps of')).toBeInTheDocument();
    expect(screen.queryByText('Weight')).not.toBeInTheDocument();
  });

  test('deletes a bell after confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage([fixedBell]);

    await user.click(
      await screen.findByRole('button', { name: 'Remove 16 kg (×2)' }),
    );

    await waitFor(() => expect(deletedIds).toEqual(['eq.bell-1']));
  });
});
