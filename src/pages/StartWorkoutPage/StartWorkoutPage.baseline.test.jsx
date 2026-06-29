import { render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

import { DEFAULT_WORKOUT_OPTIONS, WorkoutOptionsContext } from '~/contexts';
import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { StartWorkoutPage } from './StartWorkoutPage';

// PROD-174 baseline: with every discovery flag off the page must be the pure
// custom builder. The flags are on in the test env, so mock the effective-
// features hook the page reads to force them off.
const { mockUseFeatures } = vi.hoisted(() => ({ mockUseFeatures: vi.fn() }));
vi.mock('~/hooks', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeatures: mockUseFeatures,
}));

const allFlagsOff = {
  complexMode: false,
  curatedFirstWorkout: false,
  explore: false,
  premium: false,
  recommender: false,
  repeatPrevious: false,
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

describe('StartWorkoutPage pure-builder baseline (all discovery flags off)', () => {
  beforeEach(() => {
    mockUseFeatures.mockReturnValue(allFlagsOff);
    // New user (zero logs) — the curated surface would otherwise show.
    server.use(
      http.get(`${VITE_SUPABASE_URL}/rest/v1/workout_logs`, () =>
        HttpResponse.json([]),
      ),
    );
  });

  test('opens directly in the custom builder, with no discovery surfaces', async () => {
    renderPage();

    // The builder is shown immediately — no intermediate browse screen.
    expect(await screen.findByLabelText('Movement Input')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /start workout/i }),
    ).toBeInTheDocument();

    // None of the gated surfaces (or the browse-mode chrome) render.
    expect(
      screen.queryByRole('button', { name: 'Two-Hand Swing' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Pick up where you left off'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /build custom workout/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Recommendations' }),
    ).not.toBeInTheDocument();
  });
});
