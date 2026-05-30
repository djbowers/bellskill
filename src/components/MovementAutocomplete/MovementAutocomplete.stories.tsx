import { Meta, StoryObj } from '@storybook/react';
import { HttpResponse, http } from 'msw';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';

import { VITE_SUPABASE_URL } from '~/env';
import { WeightTabValue } from '~/types';

import { MovementAutocomplete } from './MovementAutocomplete';

const MOVEMENTS_CATALOG_URL = `${VITE_SUPABASE_URL}/rest/v1/movements_catalog`;
const MOVEMENTS_URL = `${VITE_SUPABASE_URL}/rest/v1/movements`;
const USER_MOVEMENTS_URL = `${VITE_SUPABASE_URL}/rest/v1/user_movements`;

const catalogMovementDefaults = {
  primary_equipment: 'Kettlebell',
  primary_item_count: 1,
  single_or_double_arm: 'Double Arm',
};

const mockCatalogMovements = [
  { id: 'mov-1', name: 'Kettlebell Clean', ...catalogMovementDefaults },
  { id: 'mov-2', name: 'Kettlebell Snatch', ...catalogMovementDefaults },
  { id: 'mov-3', name: 'Kettlebell Press', ...catalogMovementDefaults },
];

const mockRecentMovements = [
  {
    id: 'um-1',
    canonical_name: 'Clean and Press',
    functional_movement_id: null,
    created_at: '2026-05-20T10:00:00Z',
    user_id: 'user-1',
    is_big_6: false,
    skill_tree_enabled: false,
  },
  {
    id: 'um-2',
    canonical_name: 'Kettlebell Swing',
    functional_movement_id: null,
    created_at: '2026-05-19T10:00:00Z',
    user_id: 'user-1',
    is_big_6: false,
    skill_tree_enabled: false,
  },
];

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const MovementAutocompleteDemo = ({
  initialValue = '',
  initialWeightMode = '2h' as WeightTabValue,
  showWeightModeTabs = true,
  weightModeHint = null as string | null,
  weightSummary = null as string | null,
}) => {
  const [value, setValue] = useState(initialValue);
  const [weightMode, setWeightMode] =
    useState<WeightTabValue>(initialWeightMode);

  return (
    <MovementAutocomplete
      value={value}
      onChange={setValue}
      weightMode={weightMode}
      onWeightModeChange={setWeightMode}
      showWeightModeTabs={showWeightModeTabs}
      weightModeHint={weightModeHint}
      weightSummary={weightSummary}
    />
  );
};

export default {
  component: MovementAutocomplete,
  decorators: [
    (Story) => (
      <QueryClientProvider client={makeQueryClient()}>
        <div className="max-w-sm p-4">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof MovementAutocomplete>;

type Story = StoryObj<typeof MovementAutocomplete>;

export const Default: Story = {
  render: () => <MovementAutocompleteDemo />,
  parameters: {
    msw: {
      handlers: [
        http.get(MOVEMENTS_CATALOG_URL, () => HttpResponse.json([])),
        http.get(MOVEMENTS_URL, () => HttpResponse.json([])),
        http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
      ],
    },
  },
};

export const WithRecentMovements: Story = {
  render: () => <MovementAutocompleteDemo />,
  parameters: {
    msw: {
      handlers: [
        http.get(MOVEMENTS_CATALOG_URL, () => HttpResponse.json([])),
        http.get(MOVEMENTS_URL, () => HttpResponse.json([])),
        http.get(USER_MOVEMENTS_URL, () =>
          HttpResponse.json(mockRecentMovements),
        ),
      ],
    },
  },
};

export const WithCatalogResults: Story = {
  render: () => <MovementAutocompleteDemo initialValue="Kettlebell" />,
  parameters: {
    msw: {
      handlers: [
        http.get(MOVEMENTS_CATALOG_URL, () =>
          HttpResponse.json(mockCatalogMovements),
        ),
        http.get(MOVEMENTS_URL, () => HttpResponse.json([])),
        http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
      ],
    },
  },
};

export const BodyweightMode: Story = {
  render: () => (
    <MovementAutocompleteDemo initialValue="Push" initialWeightMode="none" />
  ),
  parameters: {
    msw: {
      handlers: [
        http.get(MOVEMENTS_CATALOG_URL, () => HttpResponse.json([])),
        http.get(MOVEMENTS_URL, () => HttpResponse.json([])),
        http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
      ],
    },
  },
};

export const WithWeightSummary: Story = {
  render: () => (
    <MovementAutocompleteDemo
      initialValue="Kettlebell Swing"
      weightSummary="16 kg (2h)"
    />
  ),
  parameters: {
    msw: {
      handlers: [
        http.get(MOVEMENTS_CATALOG_URL, () => HttpResponse.json([])),
        http.get(MOVEMENTS_URL, () => HttpResponse.json([])),
        http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
      ],
    },
  },
};

export const ComplexSharedWeightHint: Story = {
  render: () => (
    <MovementAutocompleteDemo
      showWeightModeTabs={false}
      weightModeHint="Using shared weight: Two-Handed"
    />
  ),
  parameters: {
    msw: {
      handlers: [
        http.get(MOVEMENTS_CATALOG_URL, () => HttpResponse.json([])),
        http.get(MOVEMENTS_URL, () => HttpResponse.json([])),
        http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
      ],
    },
  },
};

export const CustomEntry: Story = {
  render: () => <MovementAutocompleteDemo initialValue="My Special Move" />,
  parameters: {
    msw: {
      handlers: [
        http.get(MOVEMENTS_CATALOG_URL, () => HttpResponse.json([])),
        http.get(MOVEMENTS_URL, () => HttpResponse.json([])),
        http.get(USER_MOVEMENTS_URL, () => HttpResponse.json([])),
      ],
    },
  },
};
