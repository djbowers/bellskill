import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import {
  DEFAULT_MOVEMENT_OPTIONS,
  DEFAULT_WORKOUT_OPTIONS,
  EntitlementContext,
  SessionProvider,
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

// App only mounts this page behind a resolved session, so the program queries
// always have a user id. Without one they stay disabled and the program gate
// never settles, leaving the page on its loading state.
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

/** The page under the providers App gives it, for tests not driving a story. */
const renderStartWorkoutPage = (workoutOptions, startWorkout) =>
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <SessionProvider value={mockSession}>
          <EntitlementContext.Provider value={freeEntitlement}>
            <WorkoutOptionsContext.Provider
              value={[workoutOptions, startWorkout]}
            >
              <StartWorkoutPage />
            </WorkoutOptionsContext.Provider>
          </EntitlementContext.Provider>
        </SessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const { Default, WithoutPreviousVolume } = composeStories(stories);

const startedAt = new Date();
vi.setSystemTime(startedAt);

// The builder is a secondary state behind the hub. With no active program the
// hub shows the quick-start hero, whose "Build a workout" action opens the
// builder; reveal it before exercising the builder controls.
// The program gate resolves asynchronously, so wait the hub out rather than
// querying the still-pending loading state.
const enterBuildMode = async () =>
  userEvent.click(
    await screen.findByRole('button', { name: /build a workout/i }),
  );

const selectMode = (name) =>
  userEvent.click(screen.getByRole('tab', { name }));

const sharedBellToggle = () =>
  screen.getByRole('button', { name: /^Shared Bell,/ });

const toggleSharedBell = () => userEvent.click(sharedBellToggle());

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

  test('shows a back link to home in build mode', () => {
    expect(
      screen.getByRole('button', { name: /^home$/i }),
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
        'One-Arm Kettlebell Military Press',
      );
      await userEvent.click(screen.getByRole('button', { name: /Start/i }));

      expect(startWorkout).toHaveBeenCalledWith(
        expect.objectContaining({
          movements: [
            {
              ...DEFAULT_MOVEMENT_OPTIONS,
              movementName: 'One-Arm Kettlebell Military Press',
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
      await userEvent.click(screen.getByRole('button', { name: 'Add rung' }));
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

    test('the only rung cannot be removed', async () => {
      expect(
        screen.queryByRole('button', { name: /^Remove rung/ }),
      ).not.toBeInTheDocument();
    });

    test('can remove a chosen rung, not just the last', async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Add rung' }));
      await userEvent.click(screen.getByRole('button', { name: 'Add rung' }));
      // Focus the middle rung; the remove button retargets to whatever is focused.
      await userEvent.click(screen.getByRole('button', { name: /^Rung 2,/ }));
      await userEvent.click(screen.getByLabelText('+ reps'));

      await userEvent.click(
        screen.getByRole('button', { name: 'Remove rung 2' }),
      );
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

    test('can increment reps for a focused rung independently', async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Add rung' }));
      // Focus the first rung, then increment it on the caliper picker.
      await userEvent.click(screen.getByRole('button', { name: /^Rung 1,/ }));
      await userEvent.click(screen.getByLabelText('+ reps'));
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

    test('can decrement reps for a focused rung independently', async () => {
      // Adding a rung focuses the new (second) rung; decrement it.
      await userEvent.click(screen.getByRole('button', { name: 'Add rung' }));
      await userEvent.click(screen.getByLabelText('- reps'));
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

  test('Circuit is selected by default and no shared weight section is shown', () => {
    expect(screen.getByRole('tab', { name: 'Circuit' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.queryByText(
        'Complete all movements before setting the weight down.',
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Shared Weight' }),
    ).not.toBeInTheDocument();
  });

  test('exactly one mode is selected at a time', async () => {
    const selected = () =>
      ['Circuit', 'Straight Sets', 'Complex'].filter(
        (name) =>
          screen.getByRole('tab', { name }).getAttribute('aria-selected') ===
          'true',
      );

    expect(selected()).toEqual(['Circuit']);

    await selectMode('Straight Sets');
    expect(selected()).toEqual(['Straight Sets']);

    await selectMode('Complex');
    expect(selected()).toEqual(['Complex']);
  });

  test('selecting Complex reveals shared weight section with all four weight-type options', async () => {
    await selectMode('Complex');

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
    expect(screen.getAllByText('Load')).toHaveLength(2);

    await selectMode('Complex');

    expect(screen.queryAllByText('Load')).toHaveLength(0);
    expect(screen.getAllByText('Rep scheme')).toHaveLength(2);
  });

  test('leaving Complex keeps the shared bell, which the toggle then releases', async () => {
    await selectMode('Complex');
    expect(
      screen.getByRole('heading', { name: 'Shared Weight' }),
    ).toBeInTheDocument();

    // The bell is its own axis now: changing the arrangement must not throw away
    // a weight the user just dialled in.
    await selectMode('Circuit');
    expect(
      screen.getByRole('heading', { name: 'Shared Weight' }),
    ).toBeInTheDocument();

    await toggleSharedBell();

    expect(
      screen.queryByRole('heading', { name: 'Shared Weight' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Load')).toBeInTheDocument();
  });

  test('Complex locks the shared bell on', async () => {
    await selectMode('Complex');

    expect(sharedBellToggle()).toBeDisabled();
    expect(sharedBellToggle()).toHaveAttribute('aria-pressed', 'true');
    // Reads as locked, not merely on — there is no hover affordance on touch.
    expect(
      screen.getByRole('button', { name: 'Shared Bell, locked' }),
    ).toBeInTheDocument();
  });

  test('a circuit can run off one shared bell', async () => {
    await toggleSharedBell();
    await userEvent.type(screen.getByLabelText('Movement Input'), 'Clean');
    await userEvent.click(screen.getByRole('button', { name: /Start/i }));

    const options = startWorkout.mock.calls[0][0];
    expect(options.workoutMode).toBe('circuit');
    expect(options.sharedBell).toBe(true);
    // The whole point: the shared weight lands on every movement, so volume
    // accumulation and movement_logs can't disagree.
    options.movements.forEach((movement) => {
      expect(movement.weightOneValue).toBe(options.sharedWeightOneValue);
      expect(movement.weightOneUnit).toBe(options.sharedWeightOneUnit);
    });
  });

  test("startWorkout is called with workoutMode: 'complex' and shared weight fields when Complex is active", async () => {
    await selectMode('Complex');
    await userEvent.type(screen.getByLabelText('Movement Input'), 'Clean');
    await userEvent.click(screen.getByRole('button', { name: /Start/i }));

    expect(startWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        workoutMode: 'complex',
        sharedWeightOneValue: DEFAULT_MOVEMENT_OPTIONS.weightOneValue,
        sharedWeightOneUnit: DEFAULT_MOVEMENT_OPTIONS.weightOneUnit,
        sharedWeightTwoValue: null,
        sharedWeightTwoUnit: null,
        startedAt,
      }),
    );
  });

  test('propagates an edited shared weight onto every movement at start', async () => {
    await selectMode('Complex');
    await userEvent.type(screen.getByLabelText('Movement Input'), 'Clean');
    await userEvent.click(screen.getByLabelText('+ kg'));
    await userEvent.click(screen.getByRole('button', { name: /Start/i }));

    const options = startWorkout.mock.calls[0][0];
    expect(options.sharedWeightOneValue).not.toBe(
      DEFAULT_MOVEMENT_OPTIONS.weightOneValue,
    );
    options.movements.forEach((movement) => {
      expect(movement.weightOneValue).toBe(options.sharedWeightOneValue);
      expect(movement.weightOneUnit).toBe(options.sharedWeightOneUnit);
      expect(movement.weightTwoValue).toBe(options.sharedWeightTwoValue);
      expect(movement.weightTwoUnit).toBe(options.sharedWeightTwoUnit);
    });
  });

  test('movement card shows the shared weight, not its own, while Complex is on', async () => {
    await userEvent.type(screen.getByLabelText('Movement Input'), 'Clean');
    // The suggestion list hides the weight summary while it's open.
    const closeSuggestions = () =>
      userEvent.click(screen.getByRole('heading', { name: 'Movements' }));
    await closeSuggestions();
    const ownWeight = `${DEFAULT_MOVEMENT_OPTIONS.weightOneValue} kg (2h)`;
    expect(screen.getByText(ownWeight)).toBeInTheDocument();

    await selectMode('Complex');
    await userEvent.click(screen.getByLabelText('+ kg'));

    const sharedWeight = screen.getByText(/kg \(2h\)/).textContent;
    expect(sharedWeight).not.toBe(ownWeight);

    await selectMode('Circuit');
    await toggleSharedBell();

    expect(screen.getByText(ownWeight)).toBeInTheDocument();
  });

  test('complex mode is preserved when adding movements', async () => {
    await selectMode('Complex');
    expect(screen.queryAllByRole('heading', { name: 'Load' })).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: '+ Movement' }));

    expect(screen.queryAllByRole('heading', { name: 'Load' })).toHaveLength(0);
    expect(
      screen.getByRole('heading', { name: 'Shared Weight' }),
    ).toBeInTheDocument();
  });

  test('complex mode is preserved when removing movements', async () => {
    await userEvent.click(screen.getByRole('button', { name: '+ Movement' }));
    await selectMode('Complex');
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

describe('Straight Sets', () => {
  let startWorkout;

  beforeEach(async () => {
    startWorkout = vi.fn();
    Default.parameters.updateWorkoutOptions = startWorkout;
    render(<Default />);
    await enterBuildMode();
  });

  test("startWorkout is called with workoutMode: 'straightSets' when that segment is picked", async () => {
    await selectMode('Straight Sets');
    await userEvent.type(screen.getByLabelText('Movement Input'), 'Clean');
    await userEvent.click(screen.getByRole('button', { name: /Start/i }));

    expect(startWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ workoutMode: 'straightSets' }),
    );
  });

  test('uneven rep schemes are rejected in the rotating order but allowed in straight sets', async () => {
    await userEvent.type(screen.getByLabelText('Movement Input'), 'Clean');
    await userEvent.click(screen.getByRole('button', { name: '+ Movement' }));
    await userEvent.type(
      screen.getAllByLabelText('Movement Input')[1],
      'Swing',
    );

    // Give the second movement an extra rung.
    const addRungButtons = screen.getAllByRole('button', { name: 'Add rung' });
    await userEvent.click(addRungButtons[1]);

    expect(
      screen.getByText(/Rep schemes differ across movements/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start/i })).toBeDisabled();

    await selectMode('Straight Sets');

    expect(
      screen.queryByText(/Rep schemes differ across movements/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start/i })).toBeEnabled();
  });
});

describe('workout issues', () => {
  beforeEach(async () => {
    render(<Default />);
    await enterBuildMode();
  });

  /** Two movements with 1 and 2 rungs, which circuit mode can't run. */
  const buildUnequalRungs = async () => {
    await userEvent.type(screen.getByLabelText('Movement Input'), 'Clean');
    await userEvent.click(screen.getByRole('button', { name: '+ Movement' }));
    await userEvent.type(
      screen.getAllByLabelText('Movement Input')[1],
      'Swing',
    );
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Add rung' })[1],
    );
  };

  test('Switch to Straight Sets clears the error and enables Start', async () => {
    await buildUnequalRungs();
    expect(screen.getByRole('button', { name: /Start/i })).toBeDisabled();

    await userEvent.click(
      screen.getByRole('button', { name: 'Switch to Straight Sets' }),
    );

    expect(
      screen.queryByText(/Rep schemes differ across movements/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start/i })).toBeEnabled();
  });

  test('Pad to 2 rungs clears the error by repeating the last rung', async () => {
    await buildUnequalRungs();

    await userEvent.click(screen.getByRole('button', { name: 'Pad to 2 rungs' }));

    expect(
      screen.queryByText(/Rep schemes differ across movements/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start/i })).toBeEnabled();
    // Both movements now run two rungs; the short one repeated its last value.
    expect(screen.getAllByLabelText(/Rung \d/)).toHaveLength(4);
  });

  test('an unnamed movement blocks Start and flags its own card', async () => {
    expect(screen.getByRole('button', { name: /Start/i })).toBeDisabled();
    expect(screen.getByText(/This movement needs a name/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Movement Input'), 'Clean');

    expect(
      screen.queryByText(/This movement needs a name/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start/i })).toBeEnabled();
  });

});

// The builder is the only backstop for workouts it didn't build: repeat-workout,
// program sessions, and curated workouts all seed its state the same way. These
// load through the context the way those producers do.
describe('workout issues from a loaded workout', () => {
  // `editWorkout` nav state is the route history's "Repeat" takes, and it opens
  // the builder straight onto the loaded options instead of a blank build.
  const loadWorkout = async (over) => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MemoryRouter
          initialEntries={[{ pathname: '/', state: { editWorkout: true } }]}
        >
          <SessionProvider value={mockSession}>
            <EntitlementContext.Provider value={freeEntitlement}>
              <WorkoutOptionsContext.Provider
                value={[
                  {
                    ...DEFAULT_WORKOUT_OPTIONS,
                    movements: [
                      { ...DEFAULT_MOVEMENT_OPTIONS, movementName: 'Swing' },
                    ],
                    ...over,
                  },
                  vi.fn(),
                ]}
              >
                <StartWorkoutPage />
              </WorkoutOptionsContext.Provider>
            </EntitlementContext.Provider>
          </SessionProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole('button', { name: /Start/i });
  };

  test('a warning surfaces without blocking Start', async () => {
    // The builder disables the timed toggle while an interval runs, so this pair
    // is only reachable for data authored somewhere else.
    await loadWorkout({
      intervalTimer: 60,
      movements: [
        { ...DEFAULT_MOVEMENT_OPTIONS, movementName: 'Plank', timedRungs: true },
      ],
    });

    expect(screen.getByText(/both drive the set clock/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start/i })).toBeEnabled();
  });

  test('an unrunnable program session surfaces the same error and fixes', async () => {
    await loadWorkout({
      workoutMode: 'circuit',
      movements: [
        { ...DEFAULT_MOVEMENT_OPTIONS, movementName: 'A', repScheme: [1, 2, 3, 4] },
        { ...DEFAULT_MOVEMENT_OPTIONS, movementName: 'B', repScheme: [5, 5, 5] },
        { ...DEFAULT_MOVEMENT_OPTIONS, movementName: 'C', repScheme: [5, 5, 5] },
      ],
    });

    expect(
      screen.getByText(/Rep schemes differ across movements/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start/i })).toBeDisabled();

    await userEvent.click(
      screen.getByRole('button', { name: 'Pad to 4 rungs' }),
    );

    expect(screen.getByRole('button', { name: /Start/i })).toBeEnabled();
  });

  test('a bodyweight movement is runnable', async () => {
    await loadWorkout({
      movements: [
        {
          ...DEFAULT_MOVEMENT_OPTIONS,
          movementName: 'Push-Up',
          weightOneUnit: null,
          weightOneValue: null,
        },
      ],
    });

    expect(screen.getByRole('button', { name: /Start/i })).toBeEnabled();
  });
});

describe('integration tests for previous volume retrieval', () => {
  test('retrieves previous volume from workout options when available', async () => {
    const startWorkout = vi.fn();
    const customWorkoutOptions = {
      ...DEFAULT_WORKOUT_OPTIONS,
      previousVolume: 1500, // Custom previous volume
    };

    renderStartWorkoutPage(customWorkoutOptions, startWorkout);

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

    renderStartWorkoutPage(workoutOptionsAfterCompletion, startWorkout);

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

    renderStartWorkoutPage(workoutOptionsWithAllPrevious, startWorkout);

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
