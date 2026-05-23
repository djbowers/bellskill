import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import { SessionProvider } from '~/contexts';
import { server } from '~/mocks/server';
import { MovementLog } from '~/types';
import { VITE_SUPABASE_URL } from '~/env';

import { getMovementWeightMode, LinkMovementDialog } from './LinkMovementDialog';

const MOVEMENT_LOGS_URL = `${VITE_SUPABASE_URL}/rest/v1/movement_logs`;
const WORKOUT_LOGS_URL = `${VITE_SUPABASE_URL}/rest/v1/workout_logs`;
const USER_MOVEMENTS_URL = `${VITE_SUPABASE_URL}/rest/v1/user_movements`;
const MOVEMENTS_CATALOG_URL = `${VITE_SUPABASE_URL}/rest/v1/movements_catalog`;
const MOVEMENTS_URL = `${VITE_SUPABASE_URL}/rest/v1/movements`;

const mockSession = {
  user: {
    id: 'user-123',
    app_metadata: {},
    user_metadata: {},
    created_at: '',
    aud: '',
  },
  access_token: '',
  refresh_token: '',
  expires_in: 10000,
  token_type: '',
};

const baseMovementLog: MovementLog = {
  id: 1,
  movementName: 'My Custom Swing',
  repScheme: [5, 5],
  userMovementId: null,
  functionalMovementId: null,
  weightOneUnit: 'kilograms',
  weightOneValue: 16,
  weightTwoUnit: null,
  weightTwoValue: null,
};

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(SessionProvider, { value: mockSession }, children),
    );
}

function renderDialog(overrides: Partial<MovementLog> = {}) {
  return render(
    <LinkMovementDialog
      workoutLogId={42}
      movementLog={{ ...baseMovementLog, ...overrides }}
      movementIndex={0}
      complexSet={false}
      sharedWeights={{
        weightOneValue: null,
        weightOneUnit: null,
        weightTwoValue: null,
        weightTwoUnit: null,
      }}
    />,
    { wrapper: makeWrapper() },
  );
}

describe('getMovementWeightMode', () => {
  test('uses movement weights when not a complex set', () => {
    expect(
      getMovementWeightMode(
        { ...baseMovementLog, weightOneValue: 16, weightTwoValue: null },
        false,
        {
          weightOneValue: null,
          weightOneUnit: null,
          weightTwoValue: null,
          weightTwoUnit: null,
        },
      ),
    ).toBe('2h');
  });

  test('uses shared weights for complex sets', () => {
    expect(
      getMovementWeightMode(
        { ...baseMovementLog, weightOneValue: null, weightTwoValue: null },
        true,
        {
          weightOneValue: 16,
          weightOneUnit: 'kilograms',
          weightTwoValue: 0,
          weightTwoUnit: 'kilograms',
        },
      ),
    ).toBe('1h');
  });
});

describe('LinkMovementDialog', () => {
  beforeEach(() => {
    server.use(
      http.get(MOVEMENTS_CATALOG_URL, () => HttpResponse.json([])),
      http.get(MOVEMENTS_URL, () => HttpResponse.json([])),
      http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
    );
  });

  test('opens dialog and shows current movement name', async () => {
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Link' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Currently: My Custom Swing/)).toBeInTheDocument();
    expect(screen.getByText(/Catalog filtered to 2H/)).toBeInTheDocument();
  });

  test('confirm is enabled with typed input and persists link on confirm', async () => {
    let movementLogPatch: Record<string, unknown> | null = null;

    server.use(
      http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
      http.post(USER_MOVEMENTS_URL, () =>
        HttpResponse.json([{ id: 'um-linked', canonical_name: 'Kettlebell Swing' }]),
      ),
      http.patch(MOVEMENT_LOGS_URL, async ({ request }) => {
        movementLogPatch = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json([]);
      }),
      http.get(WORKOUT_LOGS_URL, () =>
        HttpResponse.json({ movements: ['My Custom Swing'] }),
      ),
      http.patch(WORKOUT_LOGS_URL, () => HttpResponse.json([])),
      http.get(MOVEMENTS_CATALOG_URL, () =>
        HttpResponse.json([
          {
            id: 'mov-1',
            name: 'Kettlebell Swing',
            primary_equipment: 'Kettlebell',
            primary_item_count: 1,
            single_or_double_arm: 'Double Arm',
          },
        ]),
      ),
    );

    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Link' }));

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Kettlebell');

    await waitFor(() => {
      expect(screen.getByText('Kettlebell Swing')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Kettlebell Swing'));

    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    expect(confirmButton).not.toBeDisabled();

    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(movementLogPatch).toEqual({
        movement_name: 'Kettlebell Swing',
        user_movement_id: 'um-linked',
      });
    });
  });
});
