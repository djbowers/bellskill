import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import {
  DEFAULT_MOVEMENT_OPTIONS,
  DEFAULT_WORKOUT_OPTIONS,
  EntitlementContext,
  WorkoutOptionsContext,
} from '~/contexts';

import { StartWorkoutPage } from './StartWorkoutPage';
import * as stories from './StartWorkoutPage.stories';

// The launchpad shell is the master gate (PROD-171): with it on, the page opens
// in browse mode and this suite reaches the builder via enterBuildMode() below.
// The content sub-flags are forced on too so the recommender surface still
// mounts under EntitlementContext for a returning user.
const { mockUseFeatureFlags } = vi.hoisted(() => ({
  mockUseFeatureFlags: vi.fn(),
}));
vi.mock('~/api', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeatureFlags: mockUseFeatureFlags,
}));
mockUseFeatureFlags.mockReturnValue({
  features: {
    launchpadShell: true,
    curatedFirstWorkout: true,
    repeatPrevious: true,
    recommender: true,
  },
  isPending: false,
});

// The recommender surface (on in the test env) reads EntitlementContext.
const freeEntitlement = {
  isPremium: false,
  isTrialing: false,
  trialExpired: false,
  trialDaysRemaining: null,
  effectiveAccess: 'free',
  isLoading: false,
  refetch: () => {},
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

const { Default, WithoutPreviousVolume } = composeStories(stories);

const startedAt = new Date();
vi.setSystemTime(startedAt);

// The builder is now collapsed behind a "Build custom workout" button; reveal
// it before exercising the builder controls.
const enterBuildMode = () =>
  userEvent.click(
    screen.getByRole('button', { name: /build custom workout/i }),
  );

describe('start workout page', () => {
  let startWorkout;

  beforeEach(async () => {
    startWorkout = vi.fn();
    Default.parameters.updateWorkoutOptions = startWorkout;

    render(<Default />);
    await enterBuildMode();
  });

  test('start button is disabled by default', () => {
    const startButton = screen.getByRole('button', { name: /Start/i });
    expect(startButton).toBeDisabled();
  });

  test('shows a back link to recommendations in build mode', () => {
    expect(
      screen.getByRole('button', { name: /recommendations/i }),
    ).toBeInTheDocument();
  });

  test('renders the Movements header with count', () => {
    expect(
      screen.getByRole('heading', { name: 'Movements' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('1 movements')).toBeInTheDocument();
  });

  test('can change the workout goal to "rounds"', async () => {
    const workoutGoalUnits = screen.getByRole('tab', { name: 'Rounds' });
    await userEvent.click(workoutGoalUnits);

    const movementInput = screen.getByLabelText('Movement Input');
    await userEvent.type(movementInput, 'Clean and Press');

    const startButton = screen.getByRole('button', { name: /Start/i });
    expect(startButton).toBeEnabled();
    await userEvent.click(startButton);

    expect(startWorkout).toHaveBeenCalledTimes(1);
    expect(startWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        workoutGoalUnits: 'rounds',
        movements: [
          {
            ...DEFAULT_MOVEMENT_OPTIONS,
            movementName: 'Clean and Press',
          },
        ],
        startedAt,
      }),
    );
  });

  test('entering a movement name enables start button', async () => {
    const movementInput = screen.getByLabelText('Movement Input');
    await userEvent.type(movementInput, 'Clean and Press');

    const startButton = screen.getByRole('button', { name: /Start/i });
    expect(startButton).toBeEnabled();
    await userEvent.click(startButton);

    expect(startWorkout).toHaveBeenCalledTimes(1);
    expect(startWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        movements: [
          {
            ...DEFAULT_MOVEMENT_OPTIONS,
            movementName: 'Clean and Press',
          },
        ],
        startedAt,
      }),
    );
  });

  test('can add new movements', async () => {
    await userEvent.click(screen.getByRole('button', { name: '+ Movement' }));

    const movementInputs = screen.getAllByLabelText('Movement Input');
    expect(movementInputs).toHaveLength(2);
  });

  test('can remove movements', async () => {
    await userEvent.click(screen.getByRole('button', { name: '+ Movement' }));

    const removeButtons = screen.getAllByRole('button', {
      name: 'Remove movement',
    });
    await userEvent.click(removeButtons[0]);

    const movementInputs = screen.getAllByLabelText('Movement Input');
    expect(movementInputs).toHaveLength(1);
  });

  test('can change movement name', async () => {
    const movementInput = screen.getByLabelText('Movement Input');
    await userEvent.type(movementInput, 'Clean and Press');

    expect(movementInput).toHaveValue('Clean and Press');
  });

  describe('Load', () => {
    test('can select "none" for bodyweight movements', async () => {
      await userEvent.click(screen.getByRole('tab', { name: 'Bodyweight' }));
      await userEvent.type(screen.getByLabelText('Movement Input'), 'Pushups');
      await userEvent.click(screen.getByRole('button', { name: /Start/i }));

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          movements: [
            {
              ...DEFAULT_MOVEMENT_OPTIONS,
              movementName: 'Pushups',
              weightOneUnit: null,
              weightOneValue: null,
              weightTwoUnit: null,
              weightTwoValue: null,
            },
          ],
          startedAt,
        }),
      );
    });

    test('can select "2h" for two-handed movements', async () => {
      await userEvent.click(screen.getByRole('tab', { name: 'Two-Hand' }));
      await userEvent.type(
        screen.getByLabelText('Movement Input'),
        'Kettlebell Swing',
      );
      await userEvent.click(screen.getByRole('button', { name: /Start/i }));

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          movements: [
            {
              ...DEFAULT_MOVEMENT_OPTIONS,
              movementName: 'Kettlebell Swing',
            },
          ],
          startedAt,
        }),
      );
    });

    test('can select "1h" for one-handed movements', async () => {
      await userEvent.click(screen.getByRole('tab', { name: 'Single' }));
      await userEvent.type(
        screen.getByLabelText('Movement Input'),
        'Single Arm Press',
      );
      await userEvent.click(screen.getByRole('button', { name: /Start/i }));

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          movements: [
            {
              ...DEFAULT_MOVEMENT_OPTIONS,
              movementName: 'Single Arm Press',
              weightTwoValue: 0,
            },
          ],
          startedAt,
        }),
      );
    });

    test('can select "double" for two-weight movements', async () => {
      await userEvent.click(screen.getByRole('tab', { name: 'Double' }));
      await userEvent.type(
        screen.getByLabelText('Movement Input'),
        'Double Clean',
      );
      await userEvent.click(screen.getByRole('button', { name: /Start/i }));

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          movements: [
            {
              ...DEFAULT_MOVEMENT_OPTIONS,
              movementName: 'Double Clean',
              weightTwoValue: 16,
              weightTwoUnit: 'kilograms',
            },
          ],
          startedAt,
        }),
      );
    });

    test('can change weight unit', async () => {
      await userEvent.click(screen.getByRole('tab', { name: 'lb' }));
      await userEvent.click(screen.getByLabelText('- lb'));
      await userEvent.type(
        screen.getByLabelText('Movement Input'),
        '1H Club Mill',
      );
      await userEvent.click(screen.getByRole('button', { name: /Start/i }));

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          movements: [
            {
              ...DEFAULT_MOVEMENT_OPTIONS,
              movementName: '1H Club Mill',
              weightOneValue: 15,
              weightOneUnit: 'pounds',
            },
          ],
          startedAt,
        }),
      );
    });
  });

  describe('Rep Scheme', () => {
    beforeEach(async () => {
      await userEvent.type(
        screen.getByLabelText('Movement Input'),
        'Test Movement',
      );
    });

    test('can add rungs', async () => {
      await userEvent.click(screen.getByRole('button', { name: '+ Rung' }));
      await userEvent.click(screen.getByRole('button', { name: /Start/i }));

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          movements: [
            {
              ...DEFAULT_MOVEMENT_OPTIONS,
              movementName: 'Test Movement',
              repScheme: [5, 5],
            },
          ],
          startedAt,
        }),
      );
    });

    test('can remove the last rung', async () => {
      await userEvent.click(screen.getByRole('button', { name: '+ Rung' }));
      await userEvent.click(screen.getByRole('button', { name: '- Rung' }));
      await userEvent.click(screen.getByRole('button', { name: /Start/i }));

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          movements: [
            {
              ...DEFAULT_MOVEMENT_OPTIONS,
              movementName: 'Test Movement',
              repScheme: [5],
            },
          ],
          startedAt,
        }),
      );
    });

    test('can increment reps for each rung independently', async () => {
      await userEvent.click(screen.getByRole('button', { name: '+ Rung' }));
      const incrementButtons = screen.getAllByRole('button', {
        name: '+ reps',
      });
      await userEvent.click(incrementButtons[0]);
      await userEvent.click(screen.getByRole('button', { name: /Start/i }));

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          movements: [
            {
              ...DEFAULT_MOVEMENT_OPTIONS,
              movementName: 'Test Movement',
              repScheme: [6, 5],
            },
          ],
          startedAt,
        }),
      );
    });

    test('can decrement reps for each rung independently', async () => {
      await userEvent.click(screen.getByRole('button', { name: '+ Rung' }));
      const decrementButtons = screen.getAllByRole('button', {
        name: '- reps',
      });
      await userEvent.click(decrementButtons[1]);
      await userEvent.click(screen.getByRole('button', { name: /Start/i }));

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          movements: [
            {
              ...DEFAULT_MOVEMENT_OPTIONS,
              movementName: 'Test Movement',
              repScheme: [5, 4],
            },
          ],
          startedAt,
        }),
      );
    });
  });

  describe('Volume Goal', () => {
    beforeEach(async () => {
      await userEvent.type(
        screen.getByLabelText('Movement Input'),
        'Test Movement',
      );
    });

    test('can change the workout goal to "volume" (kilograms)', async () => {
      const volumeTab = screen.getByRole('tab', { name: 'Volume' });
      await userEvent.click(volumeTab);

      const startButton = screen.getByRole('button', { name: /Start/i });
      await userEvent.click(startButton);

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          workoutGoalUnits: 'kilograms',
          workoutGoal: 1000, // previousVolume from DEFAULT_WORKOUT_OPTIONS
          movements: [
            {
              ...DEFAULT_MOVEMENT_OPTIONS,
              movementName: 'Test Movement',
            },
          ],
          startedAt,
        }),
      );
    });

    test('initializes volume goal to previous volume when switching to kilograms', async () => {
      const volumeTab = screen.getByRole('tab', { name: 'Volume' });
      await userEvent.click(volumeTab);

      const startButton = screen.getByRole('button', { name: /Start/i });
      await userEvent.click(startButton);

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          workoutGoalUnits: 'kilograms',
          workoutGoal: 1000, // previousVolume from DEFAULT_WORKOUT_OPTIONS
        }),
      );
    });

    test('can increment volume goal by 10kg', async () => {
      const volumeTab = screen.getByRole('tab', { name: 'Volume' });
      await userEvent.click(volumeTab);

      // Find and click the increment button for the goal
      const incrementButton = screen.getByRole('button', {
        name: '+ kilograms',
      });
      await userEvent.click(incrementButton);

      const startButton = screen.getByRole('button', { name: /Start/i });
      await userEvent.click(startButton);

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          workoutGoalUnits: 'kilograms',
          workoutGoal: 1010, // 1000 + 10
        }),
      );
    });

    test('can decrement volume goal by 10kg', async () => {
      const volumeTab = screen.getByRole('tab', { name: 'Volume' });
      await userEvent.click(volumeTab);

      // Find and click the decrement button for the goal
      const decrementButton = screen.getByRole('button', {
        name: '- kilograms',
      });
      await userEvent.click(decrementButton);

      const startButton = screen.getByRole('button', { name: /Start/i });
      await userEvent.click(startButton);

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          workoutGoalUnits: 'kilograms',
          workoutGoal: 990, // 1000 - 10
        }),
      );
    });

    test('volume goal cannot go below 1kg when decrementing', async () => {
      const volumeTab = screen.getByRole('tab', { name: 'Volume' });
      await userEvent.click(volumeTab);

      // Decrement many times to try to go below 1
      const decrementButton = screen.getByRole('button', {
        name: '- kilograms',
      });
      for (let i = 0; i < 150; i++) {
        await userEvent.click(decrementButton);
      }

      const startButton = screen.getByRole('button', { name: /Start/i });
      await userEvent.click(startButton);

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          workoutGoalUnits: 'kilograms',
          workoutGoal: 1, // minimum value
        }),
      );
    });
  });
});

describe('start workout page - without previous volume', () => {
  let startWorkoutWithoutPrevious;

  beforeEach(async () => {
    startWorkoutWithoutPrevious = vi.fn();
    WithoutPreviousVolume.parameters.updateWorkoutOptions =
      startWorkoutWithoutPrevious;

    render(<WithoutPreviousVolume />);
    await enterBuildMode();
  });

  test('initializes volume goal to default 1000kg when no previous volume exists', async () => {
    await userEvent.type(
      screen.getByLabelText('Movement Input'),
      'Test Movement',
    );

    const volumeTab = screen.getByRole('tab', { name: 'Volume' });
    await userEvent.click(volumeTab);

    const startButton = screen.getByRole('button', { name: /Start/i });
    await userEvent.click(startButton);

    expect(startWorkoutWithoutPrevious).toHaveBeenCalledWith(
      expect.objectContaining({
        workoutGoalUnits: 'kilograms',
        workoutGoal: 1000, // DEFAULT_VOLUME when previousVolume is undefined
      }),
    );
  });
});

describe('Notes', () => {
  let startWorkout;

  beforeEach(async () => {
    startWorkout = vi.fn();
    Default.parameters.updateWorkoutOptions = startWorkout;
    render(<Default />);
    await enterBuildMode();
  });

  test('clicking Notes toggle on shows the notes section', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Notes, off' }));

    expect(screen.getByRole('heading', { name: 'Pre-workout notes' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Notes, on' }),
    ).toBeInTheDocument();
  });

  test('clicking Notes toggle off hides the notes section when input is focused and empty', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Notes, off' }));
    await userEvent.click(screen.getByRole('button', { name: 'Notes, on' }));

    expect(
      screen.queryByRole('heading', { name: 'Pre-workout notes' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Notes, off' }),
    ).toBeInTheDocument();
  });

  test('clicking Notes toggle off hides the notes section when input has text', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Notes, off' }));
    await userEvent.keyboard('Heavy day');
    await userEvent.click(screen.getByRole('button', { name: 'Notes, on' }));

    expect(
      screen.queryByRole('heading', { name: 'Pre-workout notes' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Notes, off' }),
    ).toBeInTheDocument();
  });

  test('clicking away from empty notes input keeps the section visible', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Notes, off' }));
    await userEvent.click(screen.getByLabelText('Movement Input'));

    expect(screen.getByRole('heading', { name: 'Pre-workout notes' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Notes, on' }),
    ).toBeInTheDocument();
  });

  test('starting a workout with Notes on but empty saves workoutDetails as null', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Notes, off' }));
    await userEvent.type(screen.getByLabelText('Movement Input'), 'Clean');
    await userEvent.click(screen.getByRole('button', { name: /Start/i }));

    expect(startWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        preWorkoutNotes: null,
        startedAt,
      }),
    );
  });
});

describe('Complex Mode', () => {
  let startWorkout;

  beforeEach(async () => {
    startWorkout = vi.fn();
    Default.parameters.updateWorkoutOptions = startWorkout;
    render(<Default />);
    await enterBuildMode();
  });

  test('Add to workout row includes Complex toggle off by default', () => {
    expect(
      screen.getByRole('button', { name: 'Complex, off' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Complete all movements before setting the weight down.',
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Shared Weight' }),
    ).not.toBeInTheDocument();
  });

  test('selecting Complex reveals shared weight section with all four weight-type options', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Complex, off' }));

    expect(
      screen.getByText(
        'Complete all movements before setting the weight down.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Shared Weight' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bodyweight' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Two-Hand' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Single' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Double' })).toBeInTheDocument();
  });

  test('when Complex is active, per-movement weight sections are hidden and rep scheme sections remain visible', async () => {
    await userEvent.click(screen.getByRole('button', { name: '+ Movement' }));
    expect(screen.getAllByRole('heading', { name: 'Load' })).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Complex, off' }));

    expect(screen.queryAllByRole('heading', { name: 'Load' })).toHaveLength(0);
    expect(screen.getAllByRole('heading', { name: 'Rep Scheme' })).toHaveLength(
      2,
    );
  });

  test('toggling Complex off hides shared weight section and restores per-movement weight sections', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Complex, off' }));
    expect(
      screen.getByRole('heading', { name: 'Shared Weight' }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Complex, on' }));

    expect(
      screen.queryByRole('heading', { name: 'Shared Weight' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Load' })).toBeInTheDocument();
  });

  test('startWorkout is called with complexSet: true and shared weight fields when Complex is active', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Complex, off' }));
    await userEvent.type(screen.getByLabelText('Movement Input'), 'Clean');
    await userEvent.click(screen.getByRole('button', { name: /Start/i }));

    expect(startWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        complexSet: true,
        sharedWeightOneValue: DEFAULT_MOVEMENT_OPTIONS.weightOneValue,
        sharedWeightOneUnit: DEFAULT_MOVEMENT_OPTIONS.weightOneUnit,
        sharedWeightTwoValue: null,
        sharedWeightTwoUnit: null,
        startedAt,
      }),
    );
  });

  test('complex mode toggle is preserved when adding movements', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Complex, off' }));
    expect(screen.queryAllByRole('heading', { name: 'Load' })).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: '+ Movement' }));

    expect(screen.queryAllByRole('heading', { name: 'Load' })).toHaveLength(0);
    expect(
      screen.getByRole('heading', { name: 'Shared Weight' }),
    ).toBeInTheDocument();
  });

  test('complex mode toggle is preserved when removing movements', async () => {
    await userEvent.click(screen.getByRole('button', { name: '+ Movement' }));
    await userEvent.click(screen.getByRole('button', { name: 'Complex, off' }));
    expect(screen.queryAllByRole('heading', { name: 'Load' })).toHaveLength(0);

    const removeButtons = screen.getAllByRole('button', {
      name: 'Remove movement',
    });
    await userEvent.click(removeButtons[0]);

    expect(screen.queryAllByRole('heading', { name: 'Load' })).toHaveLength(0);
    expect(
      screen.getByRole('heading', { name: 'Shared Weight' }),
    ).toBeInTheDocument();
  });
});

describe('integration tests for previous volume retrieval', () => {
  test('retrieves previous volume from workout options when available', async () => {
    const startWorkout = vi.fn();
    const customWorkoutOptions = {
      ...DEFAULT_WORKOUT_OPTIONS,
      previousVolume: 1500, // Custom previous volume
    };

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter>
          <EntitlementContext.Provider value={freeEntitlement}>
            <WorkoutOptionsContext.Provider
              value={[customWorkoutOptions, startWorkout]}
            >
              <StartWorkoutPage />
            </WorkoutOptionsContext.Provider>
          </EntitlementContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await enterBuildMode();
    await userEvent.type(
      screen.getByLabelText('Movement Input'),
      'Test Movement',
    );

    const volumeTab = screen.getByRole('tab', { name: 'Volume' });
    await userEvent.click(volumeTab);

    const startButton = screen.getByRole('button', { name: /Start/i });
    await userEvent.click(startButton);

    // Verify that the workout goal is set to the previous volume
    expect(startWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        workoutGoalUnits: 'kilograms',
        workoutGoal: 1500, // Should use previousVolume from workout options
      }),
    );
  });

  test('previous volume is available in workout options after completing a volume-based workout', async () => {
    const startWorkout = vi.fn();
    const workoutOptionsAfterCompletion = {
      ...DEFAULT_WORKOUT_OPTIONS,
      previousVolume: 1200, // Volume from completed workout
    };

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter>
          <EntitlementContext.Provider value={freeEntitlement}>
            <WorkoutOptionsContext.Provider
              value={[workoutOptionsAfterCompletion, startWorkout]}
            >
              <StartWorkoutPage />
            </WorkoutOptionsContext.Provider>
          </EntitlementContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await enterBuildMode();
    await userEvent.type(
      screen.getByLabelText('Movement Input'),
      'Clean and Press',
    );

    // Switch to volume goal
    const volumeTab = screen.getByRole('tab', { name: 'Volume' });
    await userEvent.click(volumeTab);

    const startButton = screen.getByRole('button', { name: /Start/i });
    await userEvent.click(startButton);

    // Verify the previous volume is used as the initial goal
    expect(startWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        workoutGoalUnits: 'kilograms',
        workoutGoal: 1200, // Should match the previousVolume
      }),
    );
  });

  test('switches between previous values when changing goal units', async () => {
    const startWorkout = vi.fn();
    const workoutOptionsWithAllPrevious = {
      ...DEFAULT_WORKOUT_OPTIONS,
      previousVolume: 1500,
      previousMinutes: 15,
      previousRounds: 20,
    };

    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter>
          <EntitlementContext.Provider value={freeEntitlement}>
            <WorkoutOptionsContext.Provider
              value={[workoutOptionsWithAllPrevious, startWorkout]}
            >
              <StartWorkoutPage />
            </WorkoutOptionsContext.Provider>
          </EntitlementContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await enterBuildMode();
    await userEvent.type(
      screen.getByLabelText('Movement Input'),
      'Test Movement',
    );

    // Switch to volume
    const volumeTab = screen.getByRole('tab', { name: 'Volume' });
    await userEvent.click(volumeTab);

    // Switch to rounds
    const roundsTab = screen.getByRole('tab', { name: 'Rounds' });
    await userEvent.click(roundsTab);

    // Switch back to volume
    await userEvent.click(volumeTab);

    const startButton = screen.getByRole('button', { name: /Start/i });
    await userEvent.click(startButton);

    // Verify that switching back to volume restores the previous volume
    expect(startWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        workoutGoalUnits: 'kilograms',
        workoutGoal: 1500, // Should use previousVolume
      }),
    );
  });
});
