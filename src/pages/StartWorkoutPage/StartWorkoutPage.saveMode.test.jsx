import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import {
  DEFAULT_MOVEMENT_OPTIONS,
  DEFAULT_WORKOUT_OPTIONS,
  WorkoutOptionsContext,
} from '~/contexts';
import { VITE_SUPABASE_URL } from '~/env';
import { server } from '~/mocks/server';

import { StartWorkoutPage } from './StartWorkoutPage';

// Save-session mode reuses the whole builder; only the footer action changes.
// Force every discovery flag off so the page is the pure builder.
const { mockUseFeatures } = vi.hoisted(() => ({ mockUseFeatures: vi.fn() }));
vi.mock('~/hooks', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeatures: mockUseFeatures,
}));

const allFlagsOff = {
  bottomNav: false,
  explore: false,
  premium: false,
  programs: false,
  weeklyBalance: false,
};

const workoutOptions = {
  ...DEFAULT_WORKOUT_OPTIONS,
  movements: [{ ...DEFAULT_MOVEMENT_OPTIONS, movementName: 'Clean and Press' }],
};

const renderSaveMode = (programSaveMode) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter initialEntries={['/programs/p1/sessions/new']}>
        <WorkoutOptionsContext.Provider value={[workoutOptions, vi.fn()]}>
          <StartWorkoutPage programSaveMode={programSaveMode} />
        </WorkoutOptionsContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('StartWorkoutPage save-session mode', () => {
  beforeEach(() => {
    mockUseFeatures.mockReturnValue(allFlagsOff);
    server.use(
      http.get(`${VITE_SUPABASE_URL}/rest/v1/workout_logs`, () =>
        HttpResponse.json([]),
      ),
    );
  });

  it('swaps the footer from "Start workout" to "Save session"', () => {
    renderSaveMode({ onSave: vi.fn(), saving: false });

    expect(
      screen.getByRole('button', { name: 'Save session' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Start workout')).not.toBeInTheDocument();
  });

  it('disables save until a session title is entered, then calls onSave with the options and title', () => {
    const onSave = vi.fn();
    renderSaveMode({ onSave, saving: false });

    const saveButton = screen.getByRole('button', { name: 'Save session' });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('e.g. Ladders 1-2-3'), {
      target: { value: 'Ladders 1-2-3' },
    });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    const [options, title] = onSave.mock.calls[0];
    expect(title).toBe('Ladders 1-2-3');
    expect(options.movements[0].movementName).toBe('Clean and Press');
    expect(options).not.toHaveProperty('startedAt');
  });

  it('shows a saving state and disables the footer while a save is in flight', () => {
    renderSaveMode({ onSave: vi.fn(), saving: true });

    const saveButton = screen.getByRole('button', { name: 'Saving…' });
    expect(saveButton).toBeDisabled();
  });
});
