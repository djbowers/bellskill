import { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { SessionProvider } from '~/contexts';
import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { MovementDetailsPage } from './MovementDetailsPage';

const MOVEMENT_ROW = {
  id: 'movement-1',
  'Difficulty Level': 'Intermediate',
  Movement: 'Kettlebell Front Squat',
  'Movement Pattern #1': 'Knee Dominant',
  pattern_credits: ['Squat'],
  'Primary Equipment': 'Kettlebell',
  '# Primary Items': 1,
  'Single or Double Arm': 'Double Arm',
  'Target Muscle Group': 'Quadriceps',
};

const HISTORY_ROWS = [
  {
    id: 11,
    rep_scheme: [5, 5, 5],
    timed_rungs: false,
    workout_log_id: 101,
    weight_one_unit: 'kilograms',
    weight_one_value: 24,
    weight_two_unit: null,
    weight_two_value: null,
    user_movements: { functional_movement_id: 'movement-1' },
    workout_logs: {
      started_at: '2026-07-30T10:00:00Z',
      title: 'Leg Day',
      rpe: null,
    },
  },
  {
    id: 12,
    rep_scheme: [1, 2, 3],
    timed_rungs: false,
    workout_log_id: 102,
    weight_one_unit: 'kilograms',
    weight_one_value: 20,
    weight_two_unit: null,
    weight_two_value: null,
    user_movements: { functional_movement_id: 'movement-1' },
    workout_logs: {
      started_at: '2026-07-24T10:00:00Z',
      title: null,
      rpe: null,
    },
  },
];

const mockSession = { user: { id: 'user-1' } } as Session;

const renderPage = ({
  movement = MOVEMENT_ROW as object | null,
  history = HISTORY_ROWS,
}: {
  movement?: object | null;
  history?: typeof HISTORY_ROWS;
} = {}) => {
  server.use(
    http.get(`${VITE_SUPABASE_URL}/rest/v1/movements`, () =>
      movement ? HttpResponse.json(movement) : HttpResponse.json(null),
    ),
    http.get(`${VITE_SUPABASE_URL}/rest/v1/movement_logs`, () =>
      HttpResponse.json(history),
    ),
  );

  return render(
    <MemoryRouter initialEntries={['/movements/movement-1']}>
      <SessionProvider value={mockSession}>
        <QueryClientProvider client={new QueryClient()}>
          <Routes>
            <Route
              path="/movements/:id"
              element={<MovementDetailsPage />}
            />
          </Routes>
        </QueryClientProvider>
      </SessionProvider>
    </MemoryRouter>,
  );
};

describe('MovementDetailsPage', () => {
  it('shows catalog details and badges', async () => {
    renderPage();

    expect(
      await screen.findByText('Kettlebell Front Squat'),
    ).toBeInTheDocument();
    expect(screen.getByText('Movement pattern')).toBeInTheDocument();
    expect(screen.getAllByText('Knee Dominant').length).toBeGreaterThan(0);
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('Target muscle group')).toBeInTheDocument();
  });

  it('shows personal stats and recent logs linking to history', async () => {
    renderPage();

    expect(await screen.findByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Heaviest bell')).toBeInTheDocument();
    expect(screen.getByText('24 kg')).toBeInTheDocument();
    expect(screen.getByText('Total reps')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();

    const logLink = screen.getByRole('link', { name: /Leg Day/ });
    expect(logLink).toHaveAttribute('href', '/history/101');
  });

  it('shows an empty state with a start-workout CTA when never trained', async () => {
    renderPage({ history: [] });

    expect(
      await screen.findByText("You haven't trained this yet"),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a workout' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('shows a not-found message for an unknown movement', async () => {
    renderPage({ movement: null });

    expect(await screen.findByText('Movement not found')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Browse movements' }),
    ).toHaveAttribute('href', '/movements');
  });
});
