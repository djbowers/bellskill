import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { SessionProvider } from '~/contexts';
import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';
import { WeightTabValue } from '~/types';

import { MovementAutocomplete } from './MovementAutocomplete';

const MOVEMENTS_URL = `${VITE_SUPABASE_URL}/rest/v1/movements`;
const MOVEMENTS_CATALOG_URL = `${VITE_SUPABASE_URL}/rest/v1/movements_catalog`;
const USER_MOVEMENTS_URL = `${VITE_SUPABASE_URL}/rest/v1/user_movements`;

const twoHandedCatalogMovement = {
  id: 'mov-2h',
  name: 'Kettlebell Swing',
  primary_equipment: 'Kettlebell',
  primary_item_count: 1,
  single_or_double_arm: 'Double Arm',
};

const singleArmCatalogMovement = {
  id: 'mov-1h',
  name: 'Kettlebell Clean',
  primary_equipment: 'Kettlebell',
  primary_item_count: 1,
  single_or_double_arm: 'Single Arm',
};

const twoHandedSnatchCatalogMovement = {
  id: 'mov-1',
  name: 'Kettlebell Snatch',
  primary_equipment: 'Kettlebell',
  primary_item_count: 1,
  single_or_double_arm: 'Double Arm',
};

const toMovementsTableRow = (movement: typeof twoHandedCatalogMovement) => ({
  id: movement.id,
  Movement: movement.name,
  'Primary Equipment': movement.primary_equipment,
  '# Primary Items': movement.primary_item_count,
  'Single or Double Arm': movement.single_or_double_arm,
});

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

function makeWrapper(withSession = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      withSession
        ? React.createElement(SessionProvider, { value: mockSession }, children)
        : children,
    );
}

interface RenderOptions {
  value?: string;
  onChange?: ReturnType<typeof vi.fn>;
  weightMode?: WeightTabValue;
  onWeightModeChange?: ReturnType<typeof vi.fn>;
  withSession?: boolean;
  showWeightModeTabs?: boolean;
  weightSummary?: string | null;
  weightModeHint?: string | null;
  weightModeLocked?: boolean;
  deferUserMovementWrite?: boolean;
  onMovementPick?: ReturnType<typeof vi.fn>;
}

function renderAutocomplete({
  value = '',
  onChange = vi.fn(),
  weightMode = '2h',
  onWeightModeChange = vi.fn(),
  withSession = true,
  showWeightModeTabs = true,
  weightSummary = null,
  weightModeHint = null,
  weightModeLocked = false,
  deferUserMovementWrite = false,
  onMovementPick,
}: RenderOptions = {}) {
  const wrapper = makeWrapper(withSession);
  return render(
    <MovementAutocomplete
      value={value}
      onChange={onChange}
      weightMode={weightMode}
      onWeightModeChange={onWeightModeChange}
      showWeightModeTabs={showWeightModeTabs}
      weightSummary={weightSummary}
      weightModeHint={weightModeHint}
      weightModeLocked={weightModeLocked}
      deferUserMovementWrite={deferUserMovementWrite}
      onMovementPick={onMovementPick}
    />,
    { wrapper },
  );
}

describe('MovementAutocomplete', () => {
  beforeEach(() => {
    server.use(
      http.get(MOVEMENTS_CATALOG_URL, () => HttpResponse.json([])),
      http.get(MOVEMENTS_URL, () => HttpResponse.json([])),
      http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
    );
  });

  test('renders an input with aria-label "Movement Input"', () => {
    renderAutocomplete();
    expect(
      screen.getByRole('textbox', { name: 'Movement Input' }),
    ).toBeInTheDocument();
  });

  test('renders weight mode tabs by default', () => {
    renderAutocomplete();
    expect(screen.getByRole('tab', { name: 'Bodyweight' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Two-Hand' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Single' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Double' })).toBeInTheDocument();
  });

  test('calls onWeightModeChange when a weight tab is selected', async () => {
    const onWeightModeChange = vi.fn();
    renderAutocomplete({ onWeightModeChange });

    await userEvent.click(screen.getByRole('tab', { name: 'Single' }));
    expect(onWeightModeChange).toHaveBeenCalledWith('1h');
  });

  test('reads the mode out instead of offering tabs when it is locked', () => {
    renderAutocomplete({ weightModeLocked: true });

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByText('Two-Hand')).toBeInTheDocument();
  });

  test('keeps dropdown open while focus moves to the weight-mode tabs', async () => {
    renderAutocomplete();

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);
    await userEvent.type(input, 'Swing');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // The tabs sit below the results, so reaching for them must not dismiss
    // the list they sit under.
    await userEvent.tab();
    expect(screen.getByRole('tab', { name: 'Two-Hand' })).toHaveFocus();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  test('closes dropdown when focus leaves the picker', async () => {
    renderAutocomplete();

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);
    await userEvent.type(input, 'Swing');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // First tab lands on the weight-mode tabs (still inside the picker);
    // the second leaves the component entirely.
    await userEvent.tab();
    await userEvent.tab();
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  test('calls onChange on every keystroke with accumulated value', async () => {
    const onChange = vi.fn();
    renderAutocomplete({ onChange });

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.type(input, 'Swing');

    expect(onChange).toHaveBeenCalledTimes(5);
    expect(onChange).toHaveBeenNthCalledWith(1, 'S');
    expect(onChange).toHaveBeenNthCalledWith(2, 'Sw');
    expect(onChange).toHaveBeenNthCalledWith(3, 'Swi');
    expect(onChange).toHaveBeenNthCalledWith(4, 'Swin');
    expect(onChange).toHaveBeenNthCalledWith(5, 'Swing');
  });

  test('shows recent movements when user has movement history', async () => {
    server.use(
      http.get(USER_MOVEMENTS_URL, () =>
        HttpResponse.json([
          {
            id: 'um-1',
            canonical_name: 'Clean and Press',
            functional_movement_id: null,
            created_at: '2026-05-20T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
          {
            id: 'um-2',
            canonical_name: 'Kettlebell Swing',
            functional_movement_id: null,
            created_at: '2026-05-19T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
        ]),
      ),
    );

    renderAutocomplete();

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText('Clean and Press')).toBeInTheDocument();
      expect(screen.getByText('Kettlebell Swing')).toBeInTheDocument();
    });
    expect(screen.getByText('Recent')).toBeInTheDocument();
  });

  test('filters recent movements as user types', async () => {
    server.use(
      http.get(USER_MOVEMENTS_URL, () =>
        HttpResponse.json([
          {
            id: 'um-1',
            canonical_name: 'Clean and Press',
            functional_movement_id: null,
            created_at: '2026-05-20T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
          {
            id: 'um-2',
            canonical_name: 'Kettlebell Swing',
            functional_movement_id: null,
            created_at: '2026-05-19T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
        ]),
      ),
    );

    renderAutocomplete();

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.type(input, 'Swing');

    await waitFor(() => {
      expect(screen.getByText('Kettlebell Swing')).toBeInTheDocument();
    });
    expect(screen.queryByText('Clean and Press')).not.toBeInTheDocument();
  });

  test('shows recent movements whose mode differs from the selected tab', async () => {
    server.use(
      http.get(MOVEMENTS_URL, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('id')?.startsWith('in.')) {
          return HttpResponse.json([
            toMovementsTableRow(twoHandedCatalogMovement),
            toMovementsTableRow(singleArmCatalogMovement),
          ]);
        }
        return HttpResponse.json([]);
      }),
      http.get(USER_MOVEMENTS_URL, () =>
        HttpResponse.json([
          {
            id: 'um-1',
            canonical_name: 'Kettlebell Swing',
            functional_movement_id: 'mov-2h',
            created_at: '2026-05-20T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
          {
            id: 'um-2',
            canonical_name: 'Kettlebell Clean',
            functional_movement_id: 'mov-1h',
            created_at: '2026-05-19T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
        ]),
      ),
    );

    renderAutocomplete({ weightMode: '2h' });

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText('Kettlebell Swing')).toBeInTheDocument();
    });
    expect(screen.getByText('Kettlebell Clean')).toBeInTheDocument();
  });

  test('shows custom recent movements regardless of weight mode', async () => {
    server.use(
      http.get(USER_MOVEMENTS_URL, () =>
        HttpResponse.json([
          {
            id: 'um-1',
            canonical_name: 'My Custom Move',
            functional_movement_id: null,
            created_at: '2026-05-20T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
        ]),
      ),
    );

    renderAutocomplete({ weightMode: '1h' });

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText('My Custom Move')).toBeInTheDocument();
    });
  });

  test('shows a Custom badge only for recent movements not linked to the catalog', async () => {
    server.use(
      http.get(MOVEMENTS_URL, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('id')?.startsWith('in.')) {
          return HttpResponse.json([toMovementsTableRow(twoHandedCatalogMovement)]);
        }
        return HttpResponse.json([]);
      }),
      http.get(USER_MOVEMENTS_URL, () =>
        HttpResponse.json([
          {
            id: 'um-1',
            canonical_name: 'My Custom Move',
            functional_movement_id: null,
            created_at: '2026-05-20T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
          {
            id: 'um-2',
            canonical_name: 'Kettlebell Swing',
            functional_movement_id: 'mov-2h',
            created_at: '2026-05-19T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
        ]),
      ),
    );

    renderAutocomplete({ weightMode: '2h' });

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText('My Custom Move')).toBeInTheDocument();
      expect(screen.getByText('Kettlebell Swing')).toBeInTheDocument();
    });

    expect(screen.getByText('Custom')).toBeInTheDocument();

    const swingItem = screen.getByText('Kettlebell Swing').closest('li');
    expect(swingItem).not.toBeNull();
    expect(
      swingItem && Array.from(swingItem.querySelectorAll('span')).some(
        (el) => el.textContent === 'Custom',
      ),
    ).toBe(false);
  });

  test('selecting a recent movement calls onChange with the name', async () => {
    server.use(
      http.get(USER_MOVEMENTS_URL, () =>
        HttpResponse.json([
          {
            id: 'um-1',
            canonical_name: 'Clean and Press',
            functional_movement_id: null,
            created_at: '2026-05-20T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
        ]),
      ),
    );

    const onChange = vi.fn();
    renderAutocomplete({ onChange });

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText('Clean and Press')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Clean and Press'));
    expect(onChange).toHaveBeenCalledWith('Clean and Press');
  });

  test('matches catalog movements when all query words appear non-contiguously', async () => {
    server.use(
      http.get(MOVEMENTS_CATALOG_URL, () =>
        HttpResponse.json([
          {
            ...twoHandedCatalogMovement,
            id: 'mov-squat',
            name: 'Double Kettlebell Front Rack Squat',
          },
        ]),
      ),
    );

    renderAutocomplete({ value: 'double kettlebell squat' });

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await waitFor(() => {
      expect(
        screen.getByText('Double Kettlebell Front Rack Squat'),
      ).toBeInTheDocument();
    });
  });

  test('selecting a catalog movement creates a user_movement record', async () => {
    server.use(
      http.get(MOVEMENTS_CATALOG_URL, () =>
        HttpResponse.json([twoHandedSnatchCatalogMovement]),
      ),
    );

    let capturedInsert: unknown = null;
    server.use(
      http.post(USER_MOVEMENTS_URL, async ({ request }) => {
        capturedInsert = await request.json();
        return HttpResponse.json([
          { id: 'um-new', canonical_name: 'Kettlebell Snatch' },
        ]);
      }),
    );
    server.use(
      http.get(USER_MOVEMENTS_URL, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('canonical_name'))
          return HttpResponse.json(null);
        return HttpResponse.json([]);
      }),
    );

    const onChange = vi.fn();
    renderAutocomplete({ value: 'Kettlebell', onChange });

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText('Kettlebell Snatch')).toBeInTheDocument();
      expect(screen.getByText('Catalog')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Kettlebell Snatch'));
    expect(onChange).toHaveBeenCalledWith('Kettlebell Snatch');

    await waitFor(() => {
      expect(capturedInsert).not.toBeNull();
    });
  });

  test('defers user_movement write and calls onMovementPick instead', async () => {
    server.use(
      http.get(MOVEMENTS_CATALOG_URL, () =>
        HttpResponse.json([twoHandedSnatchCatalogMovement]),
      ),
    );

    let capturedInsert: unknown = null;
    server.use(
      http.post(USER_MOVEMENTS_URL, async ({ request }) => {
        capturedInsert = await request.json();
        return HttpResponse.json([{ id: 'um-new' }]);
      }),
    );

    const onMovementPick = vi.fn();
    renderAutocomplete({
      value: 'Kettlebell',
      deferUserMovementWrite: true,
      onMovementPick,
    });

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await waitFor(() => {
      expect(screen.getByText('Kettlebell Snatch')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Kettlebell Snatch'));

    expect(onMovementPick).toHaveBeenCalledWith(
      'Kettlebell Snatch',
      'mov-1',
      '2h',
    );
    expect(capturedInsert).toBeNull();
  });

  test('shows catalog empty state when search has no catalog matches', async () => {
    renderAutocomplete({ value: 'Swing' });

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await waitFor(() => {
      expect(
        screen.getByText(/No movements match .*Swing/i),
      ).toBeInTheDocument();
    });
  });

  test('shows custom entry option when no exact match exists', async () => {
    renderAutocomplete({ value: 'My Custom Move' });

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await waitFor(() => {
      expect(
        screen.getByText(/Use.*My Custom Move.*as custom movement/),
      ).toBeInTheDocument();
    });
  });

  test('shows weight summary chip when value is set and dropdown is closed', () => {
    renderAutocomplete({
      value: 'Kettlebell Swing',
      weightSummary: '16 kg (2h)',
    });

    expect(screen.getByText('16 kg (2h)')).toBeInTheDocument();
  });

  test('shows shared weight hint when tabs are hidden', () => {
    renderAutocomplete({
      showWeightModeTabs: false,
      weightModeHint: 'Using shared weight: Two-Hand',
    });

    expect(
      screen.getByText('Using shared weight: Two-Hand'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'Two-Hand' }),
    ).not.toBeInTheDocument();
  });

  test('does not show recent movements when there is no session', async () => {
    server.use(
      http.get(USER_MOVEMENTS_URL, () =>
        HttpResponse.json([
          {
            id: 'um-1',
            canonical_name: 'Clean and Press',
            functional_movement_id: null,
            created_at: '2026-05-20T10:00:00Z',
            user_id: 'user-123',
            is_big_6: false,
            skill_tree_enabled: false,
          },
        ]),
      ),
    );

    renderAutocomplete({ withSession: false });

    const input = screen.getByRole('textbox', { name: 'Movement Input' });
    await userEvent.click(input);

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Clean and Press')).not.toBeInTheDocument();
  });
});
