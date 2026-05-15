import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { DEFAULT_MOVEMENT_OPTIONS, DEFAULT_WORKOUT_OPTIONS, WorkoutOptionsContext } from '~/contexts';

import * as stories from './StartWorkoutPage.stories';
import { StartWorkoutPage } from './StartWorkoutPage';

const { Default, WithoutPreviousVolume } = composeStories(stories);

const startedAt = new Date();
vi.setSystemTime(startedAt);

describe('start workout page', () => {
  let startWorkout;

  beforeEach(() => {
    startWorkout = vi.fn();
    Default.parameters.updateWorkoutOptions = startWorkout;

    render(<Default />);
  });

  test('start button is disabled by default', () => {
    const startButton = screen.getByRole('button', { name: /Start/i });
    expect(startButton).toBeDisabled();
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

    const removeButtons = screen.getAllByRole('button', { name: '- Movement' });
    await userEvent.click(removeButtons[0]);

    const movementInputs = screen.getAllByLabelText('Movement Input');
    expect(movementInputs).toHaveLength(1);
  });

  test('can change movement name', async () => {
    const movementInput = screen.getByLabelText('Movement Input');
    await userEvent.type(movementInput, 'Clean and Press');

    expect(movementInput).toHaveValue('Clean and Press');
  });

  describe('Weights', () => {
    test('can select "none" for bodyweight movements', async () => {
      await userEvent.click(screen.getByRole('tab', { name: 'None' }));
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
      await userEvent.click(screen.getByRole('tab', { name: '2H' }));
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
      await userEvent.click(screen.getByRole('tab', { name: '1H' }));
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
      const incrementButton = screen.getByRole('button', { name: '+ kilograms' });
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
      const decrementButton = screen.getByRole('button', { name: '- kilograms' });
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
      const decrementButton = screen.getByRole('button', { name: '- kilograms' });
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

  beforeEach(() => {
    startWorkoutWithoutPrevious = vi.fn();
    WithoutPreviousVolume.parameters.updateWorkoutOptions =
      startWorkoutWithoutPrevious;

    render(<WithoutPreviousVolume />);
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

describe('Complex Mode', () => {
  let startWorkout;

  beforeEach(() => {
    startWorkout = vi.fn();
    Default.parameters.updateWorkoutOptions = startWorkout;
    render(<Default />);
  });

  test('Complex Mode card is visible with Standard and Complex buttons; Standard is active by default', () => {
    expect(screen.getByRole('button', { name: 'Standard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complex' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Shared Weight' })).not.toBeInTheDocument();
  });

  test('selecting Complex reveals shared weight section with all four weight-type options', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Complex' }));

    expect(screen.getByRole('heading', { name: 'Shared Weight' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'None' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '2H' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '1H' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Double' })).toBeInTheDocument();
  });

  test('when Complex is active, per-movement weight sections are hidden and rep scheme sections remain visible', async () => {
    await userEvent.click(screen.getByRole('button', { name: '+ Movement' }));
    expect(screen.getAllByRole('heading', { name: 'Weights' })).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Complex' }));

    expect(screen.queryAllByRole('heading', { name: 'Weights' })).toHaveLength(0);
    expect(screen.getAllByRole('heading', { name: 'Rep Scheme' })).toHaveLength(2);
  });

  test('selecting Standard hides shared weight section and restores per-movement weight sections', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Complex' }));
    expect(screen.getByRole('heading', { name: 'Shared Weight' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Standard' }));

    expect(screen.queryByRole('heading', { name: 'Shared Weight' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Weights' })).toBeInTheDocument();
  });

  test('startWorkout is called with complexSet: true and shared weight fields when Complex is active', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Complex' }));
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
    await userEvent.click(screen.getByRole('button', { name: 'Complex' }));
    expect(screen.queryAllByRole('heading', { name: 'Weights' })).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: '+ Movement' }));

    expect(screen.queryAllByRole('heading', { name: 'Weights' })).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Shared Weight' })).toBeInTheDocument();
  });

  test('complex mode toggle is preserved when removing movements', async () => {
    await userEvent.click(screen.getByRole('button', { name: '+ Movement' }));
    await userEvent.click(screen.getByRole('button', { name: 'Complex' }));
    expect(screen.queryAllByRole('heading', { name: 'Weights' })).toHaveLength(0);

    const removeButtons = screen.getAllByRole('button', { name: '- Movement' });
    await userEvent.click(removeButtons[0]);

    expect(screen.queryAllByRole('heading', { name: 'Weights' })).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Shared Weight' })).toBeInTheDocument();
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
      <MemoryRouter>
        <WorkoutOptionsContext.Provider value={[customWorkoutOptions, startWorkout]}>
          <StartWorkoutPage />
        </WorkoutOptionsContext.Provider>
      </MemoryRouter>
    );

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
      <MemoryRouter>
        <WorkoutOptionsContext.Provider value={[workoutOptionsAfterCompletion, startWorkout]}>
          <StartWorkoutPage />
        </WorkoutOptionsContext.Provider>
      </MemoryRouter>
    );

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
      <MemoryRouter>
        <WorkoutOptionsContext.Provider value={[workoutOptionsWithAllPrevious, startWorkout]}>
          <StartWorkoutPage />
        </WorkoutOptionsContext.Provider>
      </MemoryRouter>
    );

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
