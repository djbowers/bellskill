import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import React from 'react';

import { SessionProvider } from '~/contexts';
import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';
import { MovementOptions } from '~/types';

import { MovementCard, MovementCardProps } from './MovementCard';

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

const movement: MovementOptions = {
  movementName: 'Clean',
  repScheme: [5],
  weightOneValue: 16,
  weightOneUnit: 'kilograms',
  weightTwoValue: null,
  weightTwoUnit: null,
};

const noop = () => {};

const baseProps: MovementCardProps = {
  index: 0,
  movement,
  sharedBell: false,
  sharedWeightTabValue: '2h',
  sharedWeights: {
    sharedWeightOneValue: 24,
    sharedWeightOneUnit: 'kilograms',
    sharedWeightTwoValue: null,
    sharedWeightTwoUnit: null,
  },
  expanded: true,
  intervalActive: false,
  onToggleExpanded: noop,
  onRemove: noop,
  onChangeName: noop,
  onChangeWeightTab: noop,
  onChangeWeightOneValue: noop,
  onChangeWeightOneUnit: noop,
  onChangeWeightTwoValue: noop,
  onChangeWeightTwoUnit: noop,
  onChangeRung: noop,
  onRemoveRung: noop,
  onAddRung: noop,
  onToggleTimed: noop,
};

const renderCard = (overrides: Partial<MovementCardProps> = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(SessionProvider, { value: mockSession }, children),
    );

  return render(<MovementCard {...baseProps} {...overrides} />, { wrapper });
};

describe('MovementCard weight display', () => {
  beforeEach(() => {
    server.use(
      http.get(`${VITE_SUPABASE_URL}/rest/v1/movements_catalog`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${VITE_SUPABASE_URL}/rest/v1/movements`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${VITE_SUPABASE_URL}/rest/v1/user_movements`, () =>
        HttpResponse.json([]),
      ),
    );
  });

  test('edits the movement own load when not a complex set', () => {
    renderCard();

    expect(screen.getByDisplayValue('16')).toBeInTheDocument();
    expect(screen.queryByText(/Shared bell/)).not.toBeInTheDocument();
  });

  test('shows the shared weight instead of the movement own when complex', () => {
    renderCard({ sharedBell: true });

    expect(screen.getByText('Shared bell · 24 kg')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('16')).not.toBeInTheDocument();
  });

  test('collapsed chips track the shared weight when complex', () => {
    renderCard({ sharedBell: true, expanded: false });

    expect(screen.getByText('24 kg')).toBeInTheDocument();
    expect(screen.queryByText('16 kg')).not.toBeInTheDocument();
  });

  test('turning the shared bell off restores the movement own weight', () => {
    const { rerender } = renderCard({ sharedBell: true });
    expect(screen.getByText('Shared bell · 24 kg')).toBeInTheDocument();

    rerender(<MovementCard {...baseProps} sharedBell={false} />);

    expect(screen.getByDisplayValue('16')).toBeInTheDocument();
    expect(screen.queryByText(/Shared bell/)).not.toBeInTheDocument();
  });

  test('does not repeat the mode and load above the controls that set them', () => {
    renderCard();

    expect(screen.queryByText('16 kg (2h)')).not.toBeInTheDocument();
  });
});

describe('MovementCard weight mode control', () => {
  beforeEach(() => {
    server.use(
      http.get(`${VITE_SUPABASE_URL}/rest/v1/movements_catalog`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${VITE_SUPABASE_URL}/rest/v1/movements`, () =>
        HttpResponse.json([]),
      ),
      http.get(`${VITE_SUPABASE_URL}/rest/v1/user_movements`, () =>
        HttpResponse.json([]),
      ),
    );
  });

  test('reads the mode out for a movement the catalog knows', () => {
    renderCard({ catalogWeightMode: '2h' });

    expect(screen.queryByRole('tab', { name: 'Single' })).not.toBeInTheDocument();
    expect(screen.getByText('Two-Hand')).toBeInTheDocument();
  });

  test('offers the tabs for a custom movement', () => {
    renderCard({ catalogWeightMode: null });

    expect(screen.getByRole('tab', { name: 'Single' })).toBeEnabled();
  });

  test('reads the mode out under a shared bell', () => {
    renderCard({ sharedBell: true, catalogWeightMode: null });

    expect(screen.queryByRole('tab', { name: 'Single' })).not.toBeInTheDocument();
    expect(screen.getByText('Two-Hand')).toBeInTheDocument();
  });

  test('names the mismatch when the shared bell overrides the catalog', () => {
    renderCard({ sharedBell: true, catalogWeightMode: '1h' });

    expect(
      screen.getByText('Shared bell · 24 kg · usually Single'),
    ).toBeInTheDocument();
  });

  test('states the shared weight plainly when it matches the catalog', () => {
    renderCard({ sharedBell: true, catalogWeightMode: '2h' });

    expect(screen.getByText('Shared bell · 24 kg')).toBeInTheDocument();
  });
});
