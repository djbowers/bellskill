import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { DEFAULT_WORKOUT_OPTIONS, WorkoutOptionsContext } from '~/contexts';

import { StartWorkoutPage } from './StartWorkoutPage';

// Regression coverage for the prod homepage outage (React #310, "rendered more
// hooks than during the previous render"). PR #138 added two hooks — an
// `editSeeded` ref and a `seedBuilderForEdit` effect — BELOW the
// `if (gatesPending) return <Loading />` early return. On a cold load the
// active-program query starts pending (`gatesPending` true → bail before those
// hooks), then resolves (`gatesPending` false → run them), so the hook count
// changed between renders and the homepage crashed for every logged-in user.
// The fix moves the guard below every hook; this test drives the same
// pending→resolved transition on one component instance and asserts it never
// throws.
const { mockUseActiveProgram, mockUseFeatures } = vi.hoisted(() => ({
  mockUseActiveProgram: vi.fn(),
  mockUseFeatures: vi.fn(),
}));
vi.mock('~/api', async (importOriginal) => ({
  ...(await importOriginal()),
  useActiveProgram: mockUseActiveProgram,
}));
vi.mock('~/hooks', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeatures: mockUseFeatures,
}));

const BASE_FEATURES = {
  bottomNav: false,
  complexMode: false,
  explore: false,
  premium: false,
  programs: true,
  weeklyBalance: false,
};

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

const renderPage = () =>
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[{ pathname: '/', state: null }]}>
        <WorkoutOptionsContext.Provider
          value={[DEFAULT_WORKOUT_OPTIONS, vi.fn()]}
        >
          <StartWorkoutPage />
        </WorkoutOptionsContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('StartWorkoutPage hooks-order stability', () => {
  beforeEach(() => {
    mockUseFeatures.mockReturnValue(BASE_FEATURES);
  });

  test('renders through the active-program pending→resolved transition without a hooks-order crash', () => {
    mockUseActiveProgram.mockReturnValue({ data: undefined, isError: false });

    const { rerender } = renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByLabelText('Movement Input')).not.toBeInTheDocument();

    mockUseActiveProgram.mockReturnValue({ data: null, isError: false });

    expect(() =>
      rerender(
        <QueryClientProvider client={makeQueryClient()}>
          <MemoryRouter initialEntries={[{ pathname: '/', state: null }]}>
            <WorkoutOptionsContext.Provider
              value={[DEFAULT_WORKOUT_OPTIONS, vi.fn()]}
            >
              <StartWorkoutPage />
            </WorkoutOptionsContext.Provider>
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    ).not.toThrow();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Movement Input')).toBeInTheDocument();
  });
});
