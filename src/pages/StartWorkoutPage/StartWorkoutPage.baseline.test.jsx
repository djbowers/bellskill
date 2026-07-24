import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { DEFAULT_WORKOUT_OPTIONS, WorkoutOptionsContext } from '~/contexts';
import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { StartWorkoutPage } from './StartWorkoutPage';

// Hub baseline: with every discovery flag off the page shows the quick-start
// hub (hero + build-a-workout), and the pure builder is one tap away. The flags
// are on in the test env, so mock the effective-features hook the page reads to
// force them off.
const { mockUseFeatures } = vi.hoisted(() => ({ mockUseFeatures: vi.fn() }));
vi.mock('~/hooks', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeatures: mockUseFeatures,
}));

const allFlagsOff = {
  complexMode: false,
  explore: false,
  premium: false,
  weeklyBalance: false,
};

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const renderPage = () =>
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={['/']}>
        <WorkoutOptionsContext.Provider
          value={[DEFAULT_WORKOUT_OPTIONS, vi.fn()]}
        >
          <Routes>
            <Route path="/" element={<StartWorkoutPage />} />
            <Route path="/active" element={<div>active workout page</div>} />
          </Routes>
        </WorkoutOptionsContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('StartWorkoutPage hub baseline (all discovery flags off)', () => {
  beforeEach(() => {
    mockUseFeatures.mockReturnValue(allFlagsOff);
    // New user (zero logs) — the curated surface would otherwise show.
    server.use(
      http.get(`${VITE_SUPABASE_URL}/rest/v1/workout_logs`, () =>
        HttpResponse.json([]),
      ),
    );
  });

  test('shows the quick-start hub with no discovery surfaces, builder one tap away', async () => {
    renderPage();

    // The hub's quick-start hero is the landing — not the raw builder.
    expect(await screen.findByText('Start a workout')).toBeInTheDocument();
    const buildButton = screen.getByRole('button', {
      name: /build a workout/i,
    });
    expect(buildButton).toBeInTheDocument();

    // No discovery content with the flags off.
    expect(
      screen.queryByText('Pick up where you left off'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Your recommended first workout'),
    ).not.toBeInTheDocument();
    // The builder isn't mounted until the user asks for it.
    expect(screen.queryByLabelText('Movement Input')).not.toBeInTheDocument();

    // Building a workout opens the full builder as a secondary state.
    await userEvent.click(buildButton);
    expect(await screen.findByLabelText('Movement Input')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /start workout/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^home$/i }),
    ).toBeInTheDocument();
  });
});
