import { composeStories } from '@storybook/react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { useLogWorkout } from '~/api';

// Shared across every vi.mock('~/api') factory below. Defaults: no previous
// run to race (the un-raced workout is also what any non-repeat renders) and
// the ghost_pacing flag ON so the raced path stays exercised; individual tests
// override with mockReturnValue and restore in their afterEach.
const { mockUseGhostSession, mockUseFeatureFlags } = vi.hoisted(() => ({
  mockUseGhostSession: vi.fn(() => ({ data: null })),
  mockUseFeatureFlags: vi.fn(() => ({
    features: { ghostPacing: true },
    isPending: false,
  })),
}));

beforeEach(() => {
  mockUseGhostSession.mockImplementation(() => ({ data: null }));
  mockUseFeatureFlags.mockImplementation(() => ({
    features: { ghostPacing: true },
    isPending: false,
  }));
});

import * as stories from './ActiveWorkoutPage.stories';

const {
  BodyweightMovements,
  ComplexMode,
  ComplexModeDoubleBells,
  ComplexModeDifferentRepSchemes,
  ArmorBuildingComplex,
  ArmorBuildingComplexContinuous,
  DoubleWeights,
  MixedWeights,
  MultipleMovements,
  MultipleMovementsAndMixedWeights,
  OneHanded,
  AAProtocolPlanASession,
  SingleArmComplexEMOM,
  KettlebellMileSession,
  TimedRungsVaryingDurations,
  TimedRungsVolumeGoal,
  RepLadders,
  CircuitMultipleMovements,
  StraightSets,
  StraightSetsOneHanded,
  StraightSetsUnevenLadders,
  TwoHanded,
  UnilateralLegsSingleBell,
  UnilateralLegsDoubleBells,
  WorkoutGoalRounds,
  WeightUnitsPounds,
  SingleWeight24Kg,
  DoubleWeights16And12Kg,
  SingleWeight53Lb,
  MixedUnits16KgAnd26_5Lb,
  MixedUnits35LbAnd12Kg,
  OneHanded16Kg,
  RepLadder16Kg,
  VolumeGoalExactMatch,
  VolumeGoalExceeded,
  VolumeGoalWithDecimalRounding,
  VolumeGoalWithDecimalRoundingUp,
  MinutesGoalHighVolume,
  RoundsGoalHighVolume,
  ZeroWeightValues,
  VeryLargeVolumeGoal,
  DecimalVolumeCalculation,
  MaxReps,
  LadderToMaxReps,
  MaxTimedRung,
  FixedRepsForAdjustment,
  IntervalTimer,
  GhostPaced,
} = composeStories(stories);

describe('finishing a workout', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('can finish workout early by clicking finish button', async () => {
    render(<DoubleWeights />);

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    // Should call logWorkout mutation
    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: expect.any(Number),
      completedRounds: expect.any(Number),
      completedRungs: expect.any(Number),
      completedSides: expect.any(Number),
      completedVolume: expect.any(Number),
      roundSplits: [],
    });
  });

  test('automatically finishes when reaching workout goal', async () => {
    const { workoutOptions } = WorkoutGoalRounds.parameters;
    render(<WorkoutGoalRounds />);

    // Complete all rounds
    for (let i = 0; i < workoutOptions.workoutGoal; i++) {
      await clickContinue();
    }
    await confirmGoalReached();

    // Confirming the goal dialog should call logWorkout mutation
    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: expect.any(Number),
      completedRounds: expect.any(Number),
      completedRungs: expect.any(Number),
      completedSides: expect.any(Number),
      completedVolume: expect.any(Number),
      roundSplits: [],
    });
  });

  test('keeps going past the goal when the confirm is dismissed, without re-prompting', async () => {
    const { workoutOptions } = WorkoutGoalRounds.parameters;
    render(<WorkoutGoalRounds />);

    for (let i = 0; i < workoutOptions.workoutGoal; i++) {
      await clickContinue();
    }

    const dialog = await screen.findByRole('dialog', {
      name: /goal reached/i,
    });
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Keep going' }),
    );
    expect(logWorkout).not.toHaveBeenCalled();

    // Extra rounds past the goal must not reopen the dialog.
    await clickContinue();
    expect(
      screen.queryByRole('dialog', { name: /goal reached/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );
    expect(logWorkout).toHaveBeenCalled();
  });

  test('logs correct volume when using pounds as weight units', async () => {
    render(<WeightUnitsPounds />);

    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 34,
      roundSplits: [],
    });
  });
});

describe('integration tests for previous volume persistence', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('stores completed volume in workout log when workout is finished', async () => {
    render(<SingleWeight24Kg />);

    // Complete one set: 24kg × 5 reps = 120kg
    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    // Verify completedVolume is included in the logged data
    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 120,
      roundSplits: [],
    });
  });

  test('stores completed volume when workout finishes automatically with volume goal', async () => {
    render(<VolumeGoalExactMatch />);

    // Complete one set: 24kg × 5 reps = 120kg (exactly matches goal)
    await clickContinue();
    await confirmGoalReached();

    // Should call logWorkout with completedVolume
    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 120,
      roundSplits: [],
    });
  });

  test('stores rounded completed volume in workout log', async () => {
    render(<VolumeGoalWithDecimalRounding />);

    // Complete one set: 24.08kg × 5 reps = 120.4kg
    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    // Verify volume is rounded to nearest integer
    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 120, // 120.4 rounds to 120
      roundSplits: [],
    });
  });
});

describe('volume calculation with kilogram weights', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('calculates volume correctly for single weight (24kg × 5 reps = 120kg)', async () => {
    render(<SingleWeight24Kg />);

    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 120,
      roundSplits: [],
    });
  });

  test('calculates volume correctly for double weights ((16kg + 12kg) × 5 reps = 140kg)', async () => {
    render(<DoubleWeights16And12Kg />);

    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 0,
      completedRungs: 0,
      completedSides: expect.any(Number),
      completedVolume: 140,
      roundSplits: [],
    });
  });
});

describe('volume calculation with pound weights', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('converts pounds to kilograms before calculation (53lb × 5 reps ≈ 120.2kg)', async () => {
    render(<SingleWeight53Lb />);

    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: expect.any(Number),
      roundSplits: [],
    });

    // Verify conversion accuracy: 53lb × 0.453592 × 5 reps ≈ 120.2kg (rounded to 120)
    const actualVolume = logWorkout.mock.calls[0][0].completedVolume;
    expect(actualVolume).toBeCloseTo(120, 0);
  });
});

describe('volume calculation with mixed weight units', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('converts mixed units independently (16kg + 26.5lb) × 5 reps ≈ 140kg', async () => {
    render(<MixedUnits16KgAnd26_5Lb />);

    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 0,
      completedRungs: 0,
      completedSides: expect.any(Number),
      completedVolume: expect.any(Number),
      roundSplits: [],
    });

    // Verify: (16 + 26.5 × 0.453592) × 5 ≈ 140kg
    const actualVolume = logWorkout.mock.calls[0][0].completedVolume;
    expect(actualVolume).toBeCloseTo(140, 0);
  });

  test('converts mixed units independently (35lb + 12kg) × 5 reps ≈ 139.3kg', async () => {
    render(<MixedUnits35LbAnd12Kg />);

    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 0,
      completedRungs: 0,
      completedSides: expect.any(Number),
      completedVolume: expect.any(Number),
      roundSplits: [],
    });

    // Verify: (35 × 0.453592 + 12) × 5 ≈ 139kg (rounded)
    const actualVolume = logWorkout.mock.calls[0][0].completedVolume;
    expect(actualVolume).toBeCloseTo(139, 0);
  });
});

describe('volume calculation with one-handed movements', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('uses only primary weight when weightTwoValue === 0 (16kg × 5 reps = 80kg)', async () => {
    render(<OneHanded16Kg />);

    // Complete first side
    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 0,
      completedRungs: 0,
      completedSides: 1, // finished one side of the one-handed movement
      completedVolume: 80,
      roundSplits: [],
    });
  });
});

describe('volume calculation with bodyweight movements', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('calculates volume as 0 when both weights are null', async () => {
    render(<BodyweightMovements />);

    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 0,
      completedRungs: 0,
      completedSides: expect.any(Number),
      completedVolume: 0,
      roundSplits: [],
    });
  });
});

describe('volume accumulation across multiple rungs', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('accumulates volume correctly across rep ladder [1, 2, 3] with 16kg (total = 96kg)', async () => {
    render(<RepLadder16Kg />);

    // Complete rung 1 (1 rep × 16kg = 16kg)
    await clickContinue();

    // Complete rung 2 (2 reps × 16kg = 32kg, total = 48kg)
    await clickContinue();

    // Complete rung 3 (3 reps × 16kg = 48kg, total = 96kg)
    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 6, // 1 + 2 + 3
      completedRounds: 1,
      completedRungs: 3,
      completedSides: 3, // two-handed: one side per rung across [1, 2, 3]
      completedVolume: 96, // 16 + 32 + 48
      roundSplits: [],
    });
  });
});

describe('active workout page (double weights)', () => {
  const { workoutOptions } = DoubleWeights.parameters;

  beforeEach(() => {
    render(<DoubleWeights />);
  });

  test('renders the movement name', () => {
    screen.getByText(workoutOptions.movements[0].movementName);
  });

  test('displays left and right weights', () => {
    const { movements } = workoutOptions;
    const movement = movements[0];

    const leftWeight = screen.getByTestId('left-weight');
    const rightWeight = screen.getByTestId('right-weight');

    expect(leftWeight).toHaveTextContent(movement.weightOneValue);
    expect(rightWeight).toHaveTextContent(movement.weightTwoValue);
  });
});

describe('active workout page (one-handed)', () => {
  const { workoutOptions } = OneHanded.parameters;

  beforeEach(() => {
    render(<OneHanded />);
  });

  test('alternates the active hand between left and right for each side', async () => {
    const { movements } = workoutOptions;
    const weightValue = movements[0].weightOneValue;

    const leftWeight = screen.getByTestId('left-weight');
    const rightWeight = screen.getByTestId('right-weight');
    const round = screen.getByTestId('current-round');

    // Both sides show the single bell's weight; the active hand is marked.
    expect(leftWeight).toHaveTextContent(weightValue);
    expect(rightWeight).toHaveTextContent(weightValue);
    expect(leftWeight).toHaveAttribute('data-active', 'true');
    expect(rightWeight).toHaveAttribute('data-active', 'false');
    expect(round).toHaveTextContent('1');

    await clickContinue();

    expect(leftWeight).toHaveAttribute('data-active', 'false');
    expect(rightWeight).toHaveAttribute('data-active', 'true');
    expect(round).toHaveTextContent('1');

    await clickContinue();

    expect(leftWeight).toHaveAttribute('data-active', 'true');
    expect(rightWeight).toHaveAttribute('data-active', 'false');
    expect(round).toHaveTextContent('2');

    await clickContinue();

    expect(leftWeight).toHaveAttribute('data-active', 'false');
    expect(rightWeight).toHaveAttribute('data-active', 'true');
    expect(round).toHaveTextContent('2');
  });

  test('shows the active hand and current side, advancing per side', async () => {
    const currentSide = screen.getByTestId('current-side');

    expect(currentSide).toHaveTextContent('Left hand · side 1 of 2');

    // Finish first side -> advances to second side, same rung
    await clickContinue();
    expect(currentSide).toHaveTextContent('Right hand · side 2 of 2');

    // Finish second side -> completes rung, resets to first side
    await clickContinue();
    expect(currentSide).toHaveTextContent('Left hand · side 1 of 2');
  });
});

describe('active workout page (two-handed)', () => {
  const { workoutOptions } = TwoHanded.parameters;

  beforeEach(() => {
    render(<TwoHanded />);
  });

  test('single weight is fixed on left side for two-handed workouts', async () => {
    const { movements } = workoutOptions;
    const weightValue = movements[0].weightOneValue;

    const leftWeight = screen.getByTestId('left-weight');
    const rightWeight = screen.getByTestId('right-weight');
    const round = screen.getByTestId('current-round');

    expect(leftWeight).toHaveTextContent(weightValue);
    expect(rightWeight).not.toHaveTextContent();
    expect(round).toHaveTextContent('1');

    await clickContinue();

    expect(leftWeight).toHaveTextContent(weightValue);
    expect(rightWeight).not.toHaveTextContent();
    expect(round).toHaveTextContent('2');

    await clickContinue();

    expect(leftWeight).toHaveTextContent(weightValue);
    expect(rightWeight).not.toHaveTextContent();
    expect(round).toHaveTextContent('3');
  });

  test('does not show a side indicator for single-side movements', () => {
    expect(screen.queryByTestId('current-side')).toBeNull();
  });
});

describe('active workout page (rep ladders)', () => {
  const { workoutOptions } = RepLadders.parameters;

  beforeEach(() => {
    render(<RepLadders />);
  });

  test('renders rep ladders correctly', async () => {
    const { movements } = workoutOptions;
    const repScheme = movements[0].repScheme;

    const currentReps = screen.getByTestId('current-reps');
    expect(currentReps).toHaveTextContent(repScheme[0]);

    const round = screen.getByTestId('current-round');
    const completedSection = screen.getByTestId('completed-section');
    expect(completedSection).toHaveTextContent('0');

    await clickContinue();
    expect(currentReps).toHaveTextContent(repScheme[1]);
    expect(round).toHaveTextContent('1');
    expect(completedSection).toHaveTextContent('1');

    await clickContinue();
    expect(currentReps).toHaveTextContent(repScheme[2]);

    expect(round).toHaveTextContent('1');
    expect(completedSection).toHaveTextContent('3');

    await clickContinue();
    expect(currentReps).toHaveTextContent(repScheme[0]);

    expect(round).toHaveTextContent('2');
    expect(completedSection).toHaveTextContent('6');
  });
});

describe('active workout page (mixed weights)', () => {
  const { workoutOptions } = MixedWeights.parameters;

  beforeEach(() => {
    render(<MixedWeights />);
  });

  test('alternates weights between left and right hands for each rung', async () => {
    const { movements } = workoutOptions;
    const primaryWeightValue = movements[0].weightOneValue;
    const secondaryWeightValue = movements[0].weightTwoValue;

    const leftWeight = screen.getByTestId('left-weight');
    const rightWeight = screen.getByTestId('right-weight');
    const round = screen.getByTestId('current-round');

    expect(leftWeight).toHaveTextContent(primaryWeightValue);
    expect(rightWeight).toHaveTextContent(secondaryWeightValue);

    await clickContinue();

    expect(leftWeight).toHaveTextContent(secondaryWeightValue);
    expect(rightWeight).toHaveTextContent(primaryWeightValue);
    expect(round).toHaveTextContent('1');

    await clickContinue();

    expect(leftWeight).toHaveTextContent(primaryWeightValue);
    expect(rightWeight).toHaveTextContent(secondaryWeightValue);
    expect(round).toHaveTextContent('2');
  });

  test('shows the current side within the rung, advancing per side', async () => {
    const currentSide = screen.getByTestId('current-side');

    expect(currentSide).toHaveTextContent('Side 1 of 2');

    await clickContinue();
    expect(currentSide).toHaveTextContent('Side 2 of 2');

    await clickContinue();
    expect(currentSide).toHaveTextContent('Side 1 of 2');
  });
});

// The leg axis is independent of the bells: two matched 20kg bells means no
// weight swapping, but the working leg still alternates every rung.
describe('active workout page (unilateral legs, double bells)', () => {
  beforeEach(() => {
    render(<UnilateralLegsDoubleBells />);
  });

  test('mirrors each rung per leg without swapping the bells', async () => {
    const currentSide = screen.getByTestId('current-side');
    const leftWeight = screen.getByTestId('left-weight');
    const rightWeight = screen.getByTestId('right-weight');

    expect(currentSide).toHaveTextContent('Left leg · side 1 of 2');
    expect(leftWeight).toHaveTextContent('20');
    expect(rightWeight).toHaveTextContent('20');

    await clickContinue();

    expect(currentSide).toHaveTextContent('Right leg · side 2 of 2');
    expect(leftWeight).toHaveTextContent('20');
    expect(rightWeight).toHaveTextContent('20');

    await clickContinue();
    expect(currentSide).toHaveTextContent('Left leg · side 1 of 2');
    expect(screen.getByTestId('current-round')).toHaveTextContent('2');
  });
});

// Both axes on one movement — a single bell racked in one hand while one leg
// works. The axes are ORed, not multiplied: two sides, not four.
describe('active workout page (unilateral legs, single bell)', () => {
  beforeEach(() => {
    render(<UnilateralLegsSingleBell />);
  });

  test('pairs the working leg with the racked hand as one set of two sides', async () => {
    const currentSide = screen.getByTestId('current-side');
    const leftWeight = screen.getByTestId('left-weight');
    const rightWeight = screen.getByTestId('right-weight');

    // The hand is named, not the leg: which leg pairs with the bell is the
    // lifter's call (contralateral or ipsilateral), so the app does not assert it.
    expect(currentSide).toHaveTextContent('Left hand · side 1 of 2');
    expect(leftWeight).toHaveTextContent('16');

    await clickContinue();

    expect(currentSide).toHaveTextContent('Right hand · side 2 of 2');
    expect(rightWeight).toHaveTextContent('16');

    // Two sides completes the rung — the round advances rather than running a
    // third and fourth side for the leg axis.
    await clickContinue();
    expect(currentSide).toHaveTextContent('Left hand · side 1 of 2');
    expect(screen.getByTestId('current-round')).toHaveTextContent('2');
  });
});

describe('active workout page (multiple movements)', () => {
  const { workoutOptions } = MultipleMovements.parameters;

  beforeEach(() => {
    render(<MultipleMovements />);
  });

  test('alternates between movements', async () => {
    const currentMovement = screen.getByText(
      workoutOptions.movements[0].movementName,
    );

    await clickContinue();

    expect(currentMovement).toHaveTextContent(
      workoutOptions.movements[1].movementName,
    );
  });
});

describe('active workout page (multiple movements and mixed weights)', () => {
  const { workoutOptions } = MultipleMovementsAndMixedWeights.parameters;

  beforeEach(() => {
    render(<MultipleMovementsAndMixedWeights />);
  });

  test('switches between mixed weights, then movements, then reps', async () => {
    const { movements } = workoutOptions;
    const primaryWeightValue = movements[0].weightOneValue;
    const secondaryWeightValue = movements[0].weightTwoValue;

    const currentMovement = screen.getByText(movements[0].movementName);
    const leftWeight = screen.getByTestId('left-weight');
    const rightWeight = screen.getByTestId('right-weight');
    const round = screen.getByTestId('current-round');
    expect(round).toHaveTextContent('1');

    expect(leftWeight).toHaveTextContent(primaryWeightValue);
    expect(rightWeight).toHaveTextContent(secondaryWeightValue);

    await clickContinue();

    expect(currentMovement).toHaveTextContent(movements[0].movementName);
    expect(leftWeight).toHaveTextContent(secondaryWeightValue);
    expect(rightWeight).toHaveTextContent(primaryWeightValue);
    expect(round).toHaveTextContent('1');

    await clickContinue();

    expect(currentMovement).toHaveTextContent(movements[1].movementName);
    expect(leftWeight).toHaveTextContent(primaryWeightValue);
    expect(rightWeight).toHaveTextContent(secondaryWeightValue);
    expect(round).toHaveTextContent('1');

    await clickContinue();

    expect(currentMovement).toHaveTextContent(movements[1].movementName);
    expect(leftWeight).toHaveTextContent(secondaryWeightValue);
    expect(rightWeight).toHaveTextContent(primaryWeightValue);
    expect(round).toHaveTextContent('1');

    await clickContinue();

    expect(currentMovement).toHaveTextContent(movements[0].movementName);
    expect(leftWeight).toHaveTextContent(primaryWeightValue);
    expect(rightWeight).toHaveTextContent(secondaryWeightValue);
    expect(round).toHaveTextContent('2');
  });
});

describe('active workout page (bodyweight movements)', () => {
  const { workoutOptions } = BodyweightMovements.parameters;

  beforeEach(() => {
    render(<BodyweightMovements />);
  });

  test('alternates between movements', async () => {
    const currentMovement = screen.getByText(
      workoutOptions.movements[0].movementName,
    );

    await clickContinue();

    expect(currentMovement).toHaveTextContent(
      workoutOptions.movements[1].movementName,
    );
  });
});

describe('automatic workout completion with volume goals', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('automatically finishes when volume goal is exactly reached', async () => {
    render(<VolumeGoalExactMatch />);

    // Complete one set: 24kg × 5 reps = 120kg (exactly matches goal)
    await clickContinue();
    await confirmGoalReached();

    // Should call logWorkout mutation after confirming
    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 120,
      roundSplits: [],
    });
  });

  test('automatically finishes when volume goal is exceeded', async () => {
    render(<VolumeGoalExceeded />);

    // Complete one set: 24kg × 5 reps = 120kg (exceeds goal of 100kg)
    await clickContinue();
    await confirmGoalReached();

    // Should call logWorkout mutation after confirming
    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 120,
      roundSplits: [],
    });
  });
});

describe('volume rounding on workout completion', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('rounds volume down when decimal is < 0.5 (120.4kg rounds to 120kg)', async () => {
    render(<VolumeGoalWithDecimalRounding />);

    // Complete one set: 24.08kg × 5 reps = 120.4kg
    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 120, // 120.4 rounds down to 120
      roundSplits: [],
    });
  });

  test('rounds volume up when decimal is >= 0.5 (120.6kg rounds to 121kg)', async () => {
    render(<VolumeGoalWithDecimalRoundingUp />);

    // Complete one set: 24.12kg × 5 reps = 120.6kg
    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 121, // 120.6 rounds up to 121
      roundSplits: [],
    });
  });
});

describe('volume does not trigger completion for non-volume goals', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('does not finish workout when reaching high volume with minutes goal', async () => {
    render(<MinutesGoalHighVolume />);

    // Complete multiple sets to accumulate high volume
    await clickContinue(); // 120kg
    await clickContinue(); // 240kg
    await clickContinue(); // 360kg

    // Should NOT automatically finish (minutes goal is 10 minutes)
    expect(logWorkout).not.toHaveBeenCalled();
  });

  test('does not finish workout when reaching high volume with rounds goal', async () => {
    render(<RoundsGoalHighVolume />);

    // Complete multiple sets to accumulate high volume
    await clickContinue(); // 120kg, round 1
    await clickContinue(); // 240kg, round 2
    await clickContinue(); // 360kg, round 3

    // Should NOT automatically finish (rounds goal is 10 rounds)
    expect(logWorkout).not.toHaveBeenCalled();
  });
});

describe('edge case and boundary tests', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  describe('zero weight values', () => {
    test('calculates volume as 0 when weights are 0', async () => {
      render(<ZeroWeightValues />);

      await clickContinue();

      await userEvent.click(
        screen.getByRole('button', { name: /finish workout/i }),
      );

      expect(logWorkout).toHaveBeenCalledWith({
        completedRepsByMovement: expect.any(Array),
        completedReps: 5,
        completedRounds: 1,
        completedRungs: 1,
        completedSides: expect.any(Number),
        completedVolume: 0,
        roundSplits: [],
      });
    });
  });

  describe('very large volume values', () => {
    test('handles large volume values correctly (10000kg goal)', async () => {
      render(<VeryLargeVolumeGoal />);

      // Complete multiple sets to accumulate volume
      await clickContinue(); // 120kg
      await clickContinue(); // 240kg
      await clickContinue(); // 360kg

      await userEvent.click(
        screen.getByRole('button', { name: /finish workout/i }),
      );

      // Verify large volume is logged correctly
      expect(logWorkout).toHaveBeenCalledWith({
        completedRepsByMovement: expect.any(Array),
        completedReps: 15,
        completedRounds: 3,
        completedRungs: 3,
        completedSides: expect.any(Number),
        completedVolume: 360,
        roundSplits: [],
      });
    });

    test('calculates percentage correctly with large volume values', async () => {
      render(<VeryLargeVolumeGoal />);

      // Complete one set: 120kg out of 10000kg goal
      await clickContinue();

      // Progress should be visible and calculated correctly
      // 120 / 10000 = 1.2% complete, so 98.8% remaining (rounds to 99%)
      expect(screen.getByText('99%')).toBeInTheDocument();
    });
  });

  describe('decimal volume values', () => {
    test('rounds decimal volumes appropriately when logged (122.835kg rounds to 123kg)', async () => {
      render(<DecimalVolumeCalculation />);

      // Complete one set: 24.567kg × 5 reps = 122.835kg
      await clickContinue();

      await userEvent.click(
        screen.getByRole('button', { name: /finish workout/i }),
      );

      // Verify volume is rounded to nearest integer (122.835 rounds to 123)
      expect(logWorkout).toHaveBeenCalledWith({
        completedRepsByMovement: expect.any(Array),
        completedReps: 5,
        completedRounds: 1,
        completedRungs: 1,
        completedSides: expect.any(Number),
        completedVolume: 123,
        roundSplits: [],
      });
    });

    test('accumulates decimal volumes correctly across multiple rungs', async () => {
      render(<DecimalVolumeCalculation />);

      // Complete multiple sets
      await clickContinue(); // 122.835kg
      await clickContinue(); // 245.67kg
      await clickContinue(); // 368.505kg

      await userEvent.click(
        screen.getByRole('button', { name: /finish workout/i }),
      );

      // Verify accumulated decimal volume is rounded correctly (368.505 rounds to 369)
      expect(logWorkout).toHaveBeenCalledWith({
        completedRepsByMovement: expect.any(Array),
        completedReps: 15,
        completedRounds: 3,
        completedRungs: 3,
        completedSides: expect.any(Number),
        completedVolume: 369,
        roundSplits: [],
      });
    });

    test('handles decimal rounding edge cases (0.5 rounds up)', async () => {
      render(<DecimalVolumeCalculation />);

      // Complete two sets: 24.567kg × 5 reps × 2 = 245.67kg
      await clickContinue();
      await clickContinue();

      await userEvent.click(
        screen.getByRole('button', { name: /finish workout/i }),
      );

      // Verify 245.67 rounds to 246
      expect(logWorkout).toHaveBeenCalledWith({
        completedRepsByMovement: expect.any(Array),
        completedReps: 10,
        completedRounds: 2,
        completedRungs: 2,
        completedSides: expect.any(Number),
        completedVolume: 246,
        roundSplits: [],
      });
    });
  });
});

describe('volume calculation for complex mode', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('sums volume across all movements per press (single bell, 3 movements, 24kg × 5 reps each = 360kg)', async () => {
    render(<ComplexMode />);

    // repScheme [5, 4, 3, 2, 1] — first press is rung 0 (5 reps each)
    await clickCompleteSet();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    // 3 movements × 24kg × 5 reps = 360kg
    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 15, // 5 + 5 + 5
      completedRounds: 0, // still in round 1 (only 1 of 5 rungs done)
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 360,
      roundSplits: [],
    });
  });

  test('accumulates volume across all rungs for a full round (single bell, 3 movements, 24kg)', async () => {
    render(<ComplexMode />);

    // repScheme [5, 4, 3, 2, 1] — complete all 5 rungs
    await clickCompleteSet(); // rung 0: 5 reps each → 360kg
    await clickCompleteSet(); // rung 1: 4 reps each → 288kg
    await clickCompleteSet(); // rung 2: 3 reps each → 216kg
    await clickCompleteSet(); // rung 3: 2 reps each → 144kg
    await clickCompleteSet(); // rung 4: 1 rep each  →  72kg

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    // 3 movements × 24kg × (5+4+3+2+1) reps = 3 × 24 × 15 = 1080kg
    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 45, // (5+4+3+2+1) × 3 movements
      completedRounds: 1,
      completedRungs: 5,
      completedSides: expect.any(Number),
      completedVolume: 1080,
      roundSplits: [],
    });
  });

  test('runs a full Armor Building Complex session to its rounds goal (single-element repSchemes → one press per round)', async () => {
    render(<ArmorBuildingComplexContinuous />);

    // Each movement has a single-element repScheme ([2]/[1]/[3]), so
    // maxMovementRungs = 1 and ONE "Complete Set" completes a whole round.
    // Five presses reaches the 5-round goal, which auto-finishes the workout.
    await clickCompleteSet(); // round 1
    await clickCompleteSet(); // round 2
    await clickCompleteSet(); // round 3
    await clickCompleteSet(); // round 4
    await clickCompleteSet(); // round 5 → rounds goal reached, confirm dialog opens
    await confirmGoalReached();

    // The rounds goal prompts the finish confirm; accepting it ends the workout.
    // Per round: (2+1+3) reps = 6; double 24kg bells = 48kg/movement.
    // Volume/round = 48×(2+1+3) = 288kg; ×5 rounds = 1440kg.
    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 30, // 6 reps × 5 rounds
      completedRounds: 5,
      completedRungs: 5, // 1 rung per round × 5
      completedSides: expect.any(Number),
      completedVolume: 1440,
      roundSplits: [],
    });
  });

  test('calculates volume correctly for double bells in complex mode (20kg + 16kg × 5 reps, 2 movements = 360kg)', async () => {
    render(<ComplexModeDoubleBells />);

    await clickCompleteSet();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    // 2 movements × (20 + 16)kg × 5 reps = 2 × 36 × 5 = 360kg
    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 10, // 5 + 5
      completedRounds: 1, // repScheme [5] has 1 rung — round completes on first press
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 360,
      roundSplits: [],
    });
  });
});

describe('active workout page (complex mode)', () => {
  const { workoutOptions } = ComplexMode.parameters;

  beforeEach(() => {
    render(<ComplexMode />);
  });

  test('displays all movements simultaneously', () => {
    workoutOptions.movements.forEach((movement) => {
      screen.getByText(movement.movementName);
    });
  });

  test('shows "Complete Set" button label', () => {
    screen.getByRole('button', { name: 'Complete Set' });
  });

  test('shows round number in card header', () => {
    const round = screen.getByTestId('current-round');
    expect(round).toHaveTextContent('1');
  });

  // Regression guard for PROD-245: a two-hand complex (weightTwoValue null) is
  // NOT a single-arm complex, so it must not alternate sides or show the side
  // indicator that single-bell one-arm complexes now render.
  test('does not show a side indicator (two-hand complex, no side-switching)', () => {
    expect(screen.queryByTestId('current-side')).toBeNull();
  });

  test('shows shared weight in card header', () => {
    const weight = screen.getByTestId('complex-shared-weight');
    expect(weight).toHaveTextContent('24');
  });

  test('shows each movement name with truncation class', () => {
    workoutOptions.movements.forEach((_movement, index) => {
      const nameEl = screen.getByTestId(`complex-movement-name-${index}`);
      expect(nameEl).toHaveClass('truncate');
    });
  });

  test('shows rep count for each movement at current rung', () => {
    workoutOptions.movements.forEach((movement, index) => {
      const repEl = screen.getByTestId(`complex-movement-reps-${index}`);
      expect(repEl).toHaveTextContent(String(movement.repScheme[0]));
    });
  });

  test('advances all movements rung indices simultaneously', async () => {
    // repScheme [5, 4, 3, 2, 1] — rung 0 shows 5 for all movements
    workoutOptions.movements.forEach((movement, index) => {
      expect(
        screen.getByTestId(`complex-movement-reps-${index}`),
      ).toHaveTextContent(String(movement.repScheme[0]));
    });

    await clickCompleteSet();

    // After first press, all advance to rung 1 → shows 4 for all movements
    workoutOptions.movements.forEach((movement, index) => {
      expect(
        screen.getByTestId(`complex-movement-reps-${index}`),
      ).toHaveTextContent(String(movement.repScheme[1]));
    });
    expect(screen.getByTestId('current-round')).toHaveTextContent('1');
  });

  test('increments round and resets all rung indices after final rung', async () => {
    const round = screen.getByTestId('current-round');

    // Click through all 5 rungs (repScheme [5, 4, 3, 2, 1])
    await clickCompleteSet(); // rung 1
    await clickCompleteSet(); // rung 2
    await clickCompleteSet(); // rung 3
    await clickCompleteSet(); // rung 4 (final)

    // Still on round 1 at the last rung
    expect(round).toHaveTextContent('1');
    workoutOptions.movements.forEach((movement, index) => {
      expect(
        screen.getByTestId(`complex-movement-reps-${index}`),
      ).toHaveTextContent(String(movement.repScheme[4]));
    });

    await clickCompleteSet(); // completes round — round increments, rung resets

    expect(round).toHaveTextContent('2');
    workoutOptions.movements.forEach((movement, index) => {
      expect(
        screen.getByTestId(`complex-movement-reps-${index}`),
      ).toHaveTextContent(String(movement.repScheme[0]));
    });
  });
});

describe('active workout page (complex mode, double bells)', () => {
  const { workoutOptions } = ComplexModeDoubleBells.parameters;

  beforeEach(() => {
    render(<ComplexModeDoubleBells />);
  });

  test('shows both bell weights in the card header', () => {
    const weightOne = screen.getByTestId('complex-shared-weight');
    const weightTwo = screen.getByTestId('complex-shared-weight-two');

    expect(weightOne).toHaveTextContent(
      String(workoutOptions.sharedWeightOneValue),
    );
    expect(weightTwo).toHaveTextContent(
      String(workoutOptions.sharedWeightTwoValue),
    );
  });
});

describe('active workout page (complex mode, different rep schemes)', () => {
  const { workoutOptions } = ComplexModeDifferentRepSchemes.parameters;

  beforeEach(() => {
    render(<ComplexModeDifferentRepSchemes />);
  });

  test('each movement displays its own rep count independently', () => {
    workoutOptions.movements.forEach((movement, index) => {
      const repEl = screen.getByTestId(`complex-movement-reps-${index}`);
      expect(repEl).toHaveTextContent(String(movement.repScheme[0]));
    });
  });

  test('shorter rep scheme clamps at its last rung while longer advances', async () => {
    // Swing: [5, 4, 3], Clean: [3]
    const swing = screen.getByTestId('complex-movement-reps-0');
    const clean = screen.getByTestId('complex-movement-reps-1');

    expect(swing).toHaveTextContent('5');
    expect(clean).toHaveTextContent('3');

    await clickCompleteSet();

    expect(swing).toHaveTextContent('4'); // rung 1
    expect(clean).toHaveTextContent('3'); // clamped at last rung (index 0)

    await clickCompleteSet();

    expect(swing).toHaveTextContent('3'); // rung 2 (final for Swing)
    expect(clean).toHaveTextContent('3'); // still clamped
  });

  test('round increments when max-length movement completes its final rung', async () => {
    const round = screen.getByTestId('current-round');

    // Swing has 3 rungs, Clean has 1 — max is 3
    await clickCompleteSet(); // rung 1
    await clickCompleteSet(); // rung 2 (final for Swing)

    expect(round).toHaveTextContent('1');

    await clickCompleteSet(); // completes round

    expect(round).toHaveTextContent('2');
    expect(screen.getByTestId('complex-movement-reps-0')).toHaveTextContent(
      '5',
    ); // Swing resets
    expect(screen.getByTestId('complex-movement-reps-1')).toHaveTextContent(
      '3',
    ); // Clean resets
  });
});

// First shipped program to use intervalTimer (A+A Protocol "Plan A"). This
// proves the runtime EMOM behavior the seed relies on: the interval timer
// auto-fires a "continue" every 30s with NO button press, and because the
// one-arm clean & jerk is one-handed each auto-fire alternates hands — left on
// the minute, right 30s later.
describe('active workout page (A+A Protocol interval EMOM cadence)', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  beforeEach(() => {
    vi.useFakeTimers();
    useLogWorkout.mockReturnValue({
      mutate: vi.fn(),
      data: null,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  test('auto-advances one side every 30s, alternating hands and completing a round each L+R cycle', () => {
    render(<AAProtocolPlanASession />);

    const leftWeight = screen.getByTestId('left-weight');
    const rightWeight = screen.getByTestId('right-weight');
    const round = screen.getByTestId('current-round');

    // Left hand active "on the minute", before any interval has elapsed.
    expect(leftWeight).toHaveAttribute('data-active', 'true');
    expect(rightWeight).toHaveAttribute('data-active', 'false');
    expect(round).toHaveTextContent('1');

    // 30s later the interval timer fires a continue on its own -> right hand.
    act(() => vi.advanceTimersByTime(30_000));
    expect(leftWeight).toHaveAttribute('data-active', 'false');
    expect(rightWeight).toHaveAttribute('data-active', 'true');
    expect(round).toHaveTextContent('1');

    // Another 30s completes the left+right cycle -> back to left, round 2.
    act(() => vi.advanceTimersByTime(30_000));
    expect(leftWeight).toHaveAttribute('data-active', 'true');
    expect(rightWeight).toHaveAttribute('data-active', 'false');
    expect(round).toHaveTextContent('2');
  });
});

// Single-arm complex under EMOM (PROD-245). The A+A seed's stage 2+ shape: a
// Clean + Jerk chain done on ONE hand, then the other on the next interval fire.
// complexSet no longer forfeits the arm-alternation a one-handed intervalTimer
// movement gets — the whole chain mirrors, left on the minute, right 30s later.
describe('active workout page (single-arm complex EMOM cadence)', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  beforeEach(() => {
    vi.useFakeTimers();
    useLogWorkout.mockReturnValue({
      mutate: vi.fn(),
      data: null,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  test('auto-alternates hands every 30s, one L+R pair per round', () => {
    render(<SingleArmComplexEMOM />);

    const side = screen.getByTestId('current-side');
    const round = screen.getByTestId('current-round');

    // Left hand does the whole complex "on the minute".
    expect(side).toHaveTextContent('Left hand');
    expect(side).toHaveTextContent('side 1 of 2');
    expect(round).toHaveTextContent('1');

    // 30s later the interval fires a continue on its own -> right hand.
    act(() => vi.advanceTimersByTime(30_000));
    expect(side).toHaveTextContent('Right hand');
    expect(side).toHaveTextContent('side 2 of 2');
    expect(round).toHaveTextContent('1');

    // Another 30s completes the L+R pair -> back to left, round 2.
    act(() => vi.advanceTimersByTime(30_000));
    expect(side).toHaveTextContent('Left hand');
    expect(side).toHaveTextContent('side 1 of 2');
    expect(round).toHaveTextContent('2');
  });

  test('sums volume across both movements per hand (24kg Clean + 24kg Jerk = 48kg/hand, 96kg per L+R round)', () => {
    render(<SingleArmComplexEMOM />);

    const summary = screen.getByTestId('completed-section');
    expect(summary).toHaveTextContent('0 kg');

    // Each interval fire is one hand's full complex (Clean 24 + Jerk 24 = 48kg).
    act(() => vi.advanceTimersByTime(30_000)); // left  -> 48kg
    act(() => vi.advanceTimersByTime(30_000)); // right -> 96kg, one L+R round

    expect(summary).toHaveTextContent('96 kg');
  });
});

// Timed movements (PROD-200). Carries are prescribed in seconds, so a timed
// movement's repScheme holds SECONDS per rung and the rung runs on its own
// countdown that auto-fires "continue" — no button press, like intervalTimer.
describe('active workout page (timed rungs)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useLogWorkout.mockReturnValue({
      mutate: vi.fn(),
      data: null,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  test('renders the rung as a duration under a "Time" label, not a rep count', () => {
    render(<KettlebellMileSession />);

    expect(screen.getByTestId('current-reps')).toHaveTextContent('1:00');
    // The movement card's magnitude column is labelled Time, not Reps. (The
    // workout summary further down has its own "Reps" tally, so this assertion
    // is deliberately scoped to the card.)
    expect(screen.getByTestId('current-movement-card')).toHaveTextContent(
      'Time',
    );
    expect(screen.getByTestId('current-movement-card')).not.toHaveTextContent(
      'Reps',
    );
  });

  test('auto-advances on rung expiry, alternating hands for a one-handed carry', () => {
    render(<KettlebellMileSession />);

    const leftWeight = screen.getByTestId('left-weight');
    const rightWeight = screen.getByTestId('right-weight');
    const round = screen.getByTestId('current-round');

    expect(leftWeight).toHaveAttribute('data-active', 'true');
    expect(rightWeight).toHaveAttribute('data-active', 'false');

    // A minute later the rung timer fires a continue on its own -> other hand,
    // still inside round 1.
    act(() => vi.advanceTimersByTime(60_000));
    expect(leftWeight).toHaveAttribute('data-active', 'false');
    expect(rightWeight).toHaveAttribute('data-active', 'true');
    expect(round).toHaveTextContent('1');

    // The second hand closes the round: one rung x both hands = one round, so
    // "rounds remaining" actually ticks down across the session.
    act(() => vi.advanceTimersByTime(60_000));
    expect(leftWeight).toHaveAttribute('data-active', 'true');
    expect(round).toHaveTextContent('2');
  });

  test('re-arms the countdown per rung when rung durations differ', () => {
    render(<TimedRungsVaryingDurations />);

    const currentReps = screen.getByTestId('current-reps');
    const round = screen.getByTestId('current-round');
    expect(currentReps).toHaveTextContent('0:30');

    // First rung is 30s. Advancing 30s must move to the 60s rung...
    act(() => vi.advanceTimersByTime(30_000));
    expect(currentReps).toHaveTextContent('1:00');
    expect(round).toHaveTextContent('1');

    // ...and that rung must NOT expire at 30s, which is what would happen if the
    // countdown were still armed with the first rung's duration.
    act(() => vi.advanceTimersByTime(30_000));
    expect(currentReps).toHaveTextContent('1:00');
    expect(round).toHaveTextContent('1');

    // The full 60s completes the ladder and the round.
    act(() => vi.advanceTimersByTime(30_000));
    expect(currentReps).toHaveTextContent('0:30');
    expect(round).toHaveTextContent('2');
  });

  // Regression: the workout timer's paused state doubles as the START GATE, and
  // only finishCountdown starts the rung clock. A rounds-goal timed workout has
  // no workout countdown of its own, so unless timed movements also raise the
  // gate the page opens showing a rung clock that never ticks — the lifter
  // stares at a frozen 0:05 while elapsed climbs. (The stories pass
  // defaultPaused: false, so the other tests here cannot catch this.)
  test('raises the start gate so the rung clock never runs before the lifter starts', () => {
    render(<KettlebellMileSession defaultPaused />);

    const leftWeight = screen.getByTestId('left-weight');
    expect(leftWeight).toHaveAttribute('data-active', 'true');

    // Nothing should move while the workout is still gated.
    act(() => vi.advanceTimersByTime(240_000));
    expect(leftWeight).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('current-round')).toHaveTextContent('1');

    // Start it: 3s lead-in countdown, then the 1:00 rung runs and hands swap.
    act(() => screen.getByRole('button', { name: 'Start workout' }).click());
    act(() => vi.advanceTimersByTime(3_000));
    act(() => vi.advanceTimersByTime(60_000));
    expect(leftWeight).toHaveAttribute('data-active', 'false');
  });

  test('counts neither seconds-as-reps nor seconds-as-volume', () => {
    render(<TimedRungsVolumeGoal />);

    act(() => vi.advanceTimersByTime(120_000));

    // A 120s rung at 24kg would otherwise log 120 reps and 2,880kg — blowing
    // past this story's 1,000kg goal before the first carry even finished.
    const completedSection = screen.getByTestId('completed-section');
    expect(completedSection).toHaveTextContent('Reps0');
    expect(completedSection).toHaveTextContent('Volume0');
  });
});

describe('active workout page (Armor Building Complex seed session)', () => {
  const { workoutOptions } = ArmorBuildingComplex.parameters;

  beforeEach(() => {
    render(<ArmorBuildingComplex />);
  });

  test('flows all three movements as one chain with reps 2, 1, 3', () => {
    // clean → press → squat shown together, each at its single rung.
    expect(workoutOptions.movements.map((m) => m.movementName)).toEqual([
      'Double Kettlebell Clean',
      'Double Kettlebell Military Press',
      'Double Kettlebell Front Squat',
    ]);
    workoutOptions.movements.forEach((movement, index) => {
      expect(
        screen.getByTestId(`complex-movement-name-${index}`),
      ).toHaveTextContent(movement.movementName);
      expect(
        screen.getByTestId(`complex-movement-reps-${index}`),
      ).toHaveTextContent(String(movement.repScheme[0]));
    });
    expect(screen.getByTestId('complex-movement-reps-0')).toHaveTextContent(
      '2',
    );
    expect(screen.getByTestId('complex-movement-reps-1')).toHaveTextContent(
      '1',
    );
    expect(screen.getByTestId('complex-movement-reps-2')).toHaveTextContent(
      '3',
    );
  });

  test('shows the double-bell shared weight (24kg + 24kg)', () => {
    expect(screen.getByTestId('complex-shared-weight')).toHaveTextContent('24');
    expect(screen.getByTestId('complex-shared-weight-two')).toHaveTextContent(
      '24',
    );
  });

  test('uses the complex "Complete Set" control (not DFW\'s "Continue")', () => {
    screen.getByRole('button', { name: 'Complete Set' });
    expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  test('one "Complete Set" completes a whole round (longest repScheme is length 1)', async () => {
    // currentRound = completedRounds + 1, so the header reads "1" before any round.
    expect(screen.getByTestId('current-round')).toHaveTextContent('1');

    await clickCompleteSet();

    // A single press exhausts the longest (length-1) repScheme, so the round
    // advances immediately — unlike a multi-rung complex or DFW's alternation.
    expect(screen.getByTestId('current-round')).toHaveTextContent('2');
  });

  test('rests between rounds (restTimer > 0 replaces the button with a rest bar)', async () => {
    await clickCompleteSet();

    // The between-rounds rest is active, so the set control is gone.
    expect(screen.getByText('rest')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete Set' })).toBeNull();
  });
});

describe('active workout page (circuit progress)', () => {
  test('places the movement in the workout as the circuit rotates', async () => {
    render(<CircuitMultipleMovements />);

    const position = screen.getByTestId('current-movement-position');
    expect(position).toHaveTextContent('Movement 1 of 3');

    await clickContinue();
    expect(position).toHaveTextContent('Movement 2 of 3');
  });

  test('tallies rounds against the goal, which the sets bar no longer shows', async () => {
    render(<CircuitMultipleMovements />);

    const summary = screen.getByTestId('completed-section');
    expect(summary).toHaveTextContent('Rounds');
    expect(summary).toHaveTextContent('0/2');

    // A round closes after all three movements.
    await clickContinue();
    await clickContinue();
    await clickContinue();
    expect(summary).toHaveTextContent('1/2');
  });

  test('counts sets, so the bar moves on every movement instead of once per lap', async () => {
    render(<CircuitMultipleMovements />);

    const remaining = screen.getByTestId('progress-bar-value');

    // 3 movements x 1 rung x 2 rounds = 6 sets.
    expect(remaining).toHaveTextContent('6');
    expect(screen.getByText('sets remaining')).toBeInTheDocument();

    await clickContinue();
    expect(remaining).toHaveTextContent('5');

    await clickContinue();
    expect(remaining).toHaveTextContent('4');

    // The lap closes here: the count must step by one, not stall or jump.
    await clickContinue();
    expect(remaining).toHaveTextContent('3');
    expect(screen.getByTestId('current-round')).toHaveTextContent('2');
  });
});

describe('active workout page (straight sets)', () => {
  const { workoutOptions } = StraightSets.parameters;

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('completes every rung of a movement before moving to the next', async () => {
    render(<StraightSets />);

    const currentMovement = screen.getByTestId('current-movement-card');
    const names = workoutOptions.movements.map((m) => m.movementName);

    // Two sets each, in order — not one set of each, twice.
    for (const name of names) {
      expect(currentMovement).toHaveTextContent(name);
      expect(screen.getByTestId('current-set')).toHaveTextContent('Set 1 of 2');
      await clickContinue();

      expect(currentMovement).toHaveTextContent(name);
      expect(screen.getByTestId('current-set')).toHaveTextContent('Set 2 of 2');
      await clickContinue();
    }
  });

  test('never returns to a movement it has finished', async () => {
    render(<StraightSets />);

    const currentMovement = screen.getByTestId('current-movement-card');
    const names = workoutOptions.movements.map((m) => m.movementName);
    const seen = [];

    for (let i = 0; i < 9; i++) {
      const shown = names.find((name) =>
        currentMovement.textContent.includes(name),
      );
      if (seen.at(-1) !== shown) {
        expect(seen).not.toContain(shown);
        seen.push(shown);
      }
      await clickContinue();
    }

    expect(seen).toEqual(names);
  });

  test('two continues in one tick advance a single set', async () => {
    render(<StraightSets />);

    // Every advance handler reads this render's indexes, so an unguarded double
    // fire would step the rung twice and read "Set 3 of 2".
    const button = screen.getByRole('button', { name: 'Continue' });
    await act(async () => {
      button.click();
      button.click();
    });

    expect(screen.getByTestId('current-set')).toHaveTextContent('Set 2 of 2');
    expect(screen.getByTestId('progress-bar-value')).toHaveTextContent('9');
  });

  test('places the movement in the workout, and advances it', async () => {
    render(<StraightSets />);

    const position = screen.getByTestId('current-movement-position');
    expect(position).toHaveTextContent('Movement 1 of 5');

    await clickContinue();
    expect(position).toHaveTextContent('Movement 1 of 5');

    await clickContinue();
    expect(position).toHaveTextContent('Movement 2 of 5');
  });

  test('tallies sets, not rounds — straight sets logs one per set', async () => {
    render(<StraightSets />);

    const summary = screen.getByTestId('completed-section');
    expect(summary).toHaveTextContent('Sets');
    expect(summary).not.toHaveTextContent('Rounds');
    expect(summary).toHaveTextContent('0/10');

    await clickContinue();
    expect(summary).toHaveTextContent('1/10');
  });

  test('shows no round badge — straight sets has no rounds', () => {
    render(<StraightSets />);

    expect(screen.queryByTestId('current-round')).toBeNull();
    expect(screen.getByTestId('current-set')).toBeInTheDocument();
  });

  test('counts down the sets remaining as each one is finished', async () => {
    render(<StraightSets />);

    const remaining = screen.getByTestId('progress-bar-value');

    // 5 movements x 2 sets = the story's 10-set goal.
    expect(remaining).toHaveTextContent('10');
    expect(screen.getByText('sets remaining')).toBeInTheDocument();

    await clickContinue();
    expect(remaining).toHaveTextContent('9');
  });

  test('finishes only after the last movement completes its last set', async () => {
    render(<StraightSets />);

    for (let i = 0; i < 9; i++) await clickContinue();
    expect(logWorkout).not.toHaveBeenCalled();

    await clickContinue();
    await confirmGoalReached();
    expect(logWorkout).toHaveBeenCalledWith({
      completedRepsByMovement: expect.any(Array),
      completedReps: 50, // 10 sets x 5 reps
      completedRounds: 10, // one per set, against the derived set-count goal
      completedRungs: 10,
      completedSides: 10,
      completedVolume: 2400, // 48kg x 5 reps x 10 sets
      roundSplits: [],
    });
  });

  test('runs movements with different rung counts', async () => {
    render(<StraightSetsUnevenLadders />);

    const currentMovement = screen.getByTestId('current-movement-card');

    expect(screen.getByTestId('current-set')).toHaveTextContent('Set 1 of 3');
    await clickContinue();
    await clickContinue();
    expect(currentMovement).toHaveTextContent(
      'Two-Arm Kettlebell Military Press',
    );
    expect(screen.getByTestId('current-set')).toHaveTextContent('Set 3 of 3');

    await clickContinue();
    expect(currentMovement).toHaveTextContent('Kettlebell Swing');
    expect(screen.getByTestId('current-set')).toHaveTextContent('Set 1 of 2');
  });

  test('a one-handed set is both hands, and the movement starts on side 1', async () => {
    render(<StraightSetsOneHanded />);

    const currentMovement = screen.getByTestId('current-movement-card');
    const side = () => screen.getByTestId('current-side');

    expect(side()).toHaveTextContent('1');
    await clickContinue();

    // Second hand, same set.
    expect(side()).toHaveTextContent('2');
    expect(screen.getByTestId('current-set')).toHaveTextContent('Set 1 of 2');
    await clickContinue();

    expect(screen.getByTestId('current-set')).toHaveTextContent('Set 2 of 2');
    expect(side()).toHaveTextContent('1');

    await clickContinue();
    await clickContinue();
    expect(currentMovement).toHaveTextContent('One-Arm Kettlebell Row');
    expect(side()).toHaveTextContent('1');
  });
});

describe('cancelling a workout', () => {
  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('cancel button opens a confirmation dialog', async () => {
    render(<DoubleWeights />);

    await userEvent.click(
      screen.getByRole('button', { name: /cancel workout/i }),
    );

    expect(screen.getByText('Cancel this workout?')).toBeInTheDocument();
    expect(logWorkout).not.toHaveBeenCalled();
  });

  test('keep going dismisses the dialog and the workout continues', async () => {
    render(<DoubleWeights />);

    await userEvent.click(
      screen.getByRole('button', { name: /cancel workout/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: /keep going/i }));

    expect(screen.queryByText('Cancel this workout?')).not.toBeInTheDocument();
    expect(logWorkout).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /finish workout/i }),
    ).toBeInTheDocument();
  });

  test('discard workout does not log the workout', async () => {
    render(<DoubleWeights />);

    await userEvent.click(
      screen.getByRole('button', { name: /cancel workout/i }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /discard workout/i }),
    );

    expect(logWorkout).not.toHaveBeenCalled();
  });
});

describe('ghost pacing', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
    trackEvent: vi.fn(),
    AnalyticsEvent: { WorkoutCancelled: 'workout_cancelled' },
    // These fixtures assert the un-raced workout, which is also what any
    // workout that isn't a repeat renders.
    useGhostSession: mockUseGhostSession,
    useFeatureFlags: mockUseFeatureFlags,
  }));

  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  test('records one split per completed round, timed from the workout start', async () => {
    render(<GhostPaced />);

    // Four rounds of a single one-rung movement: each continue is a round.
    await clickContinue();
    await clickContinue();
    await clickContinue();
    await clickContinue();
    await confirmGoalReached();

    const { roundSplits } = logWorkout.mock.calls.at(-1)[0];

    expect(roundSplits.map((split) => split.roundIndex)).toEqual([0, 1, 2, 3]);
    // Elapsed is measured from startedAt, so every stamp is non-negative and
    // the sequence only ever moves forward.
    expect(roundSplits.every((split) => split.elapsedMs >= 0)).toBe(true);
    expect([...roundSplits].sort((a, b) => a.elapsedMs - b.elapsedMs)).toEqual(
      roundSplits,
    );
  });

  test('records no splits for a workout that never completes a round', async () => {
    render(<GhostPaced />);

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    expect(logWorkout).toHaveBeenCalledWith(
      expect.objectContaining({ roundSplits: [] }),
    );
  });

  test('shows no rail or lap pill when there is nothing to race', async () => {
    render(<GhostPaced />);
    await clickContinue();

    expect(screen.queryByTestId('ghost-rail')).not.toBeInTheDocument();
    expect(screen.queryByTestId('lap-delta-pill')).not.toBeInTheDocument();
  });

  const previousRun = {
    workoutLogId: 99,
    completedAt: new Date(),
    totalRounds: 4,
    totalDurationMs: 240_000,
    splits: [],
  };

  test('shows the rail when the flag is on and there is a previous run', () => {
    mockUseGhostSession.mockReturnValue({ data: previousRun });

    render(<GhostPaced />);

    expect(screen.getByTestId('ghost-rail')).toBeInTheDocument();
  });

  test('shows no rail when the ghost_pacing flag is off, even with a previous run', () => {
    mockUseFeatureFlags.mockReturnValue({
      features: { ghostPacing: false },
      isPending: false,
    });
    mockUseGhostSession.mockReturnValue({ data: previousRun });

    render(<GhostPaced />);

    expect(mockUseGhostSession).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(screen.queryByTestId('ghost-rail')).not.toBeInTheDocument();
  });

  test('never races a straight-sets workout, even with the flag on', () => {
    mockUseGhostSession.mockReturnValue({ data: previousRun });

    render(<StraightSets />);

    expect(mockUseGhostSession).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(screen.queryByTestId('ghost-rail')).not.toBeInTheDocument();
  });
});

const clickContinue = async () => {
  const continueButton = screen.getByRole('button', { name: 'Continue' });
  await userEvent.click(continueButton);
};

const clickCompleteSet = async () => {
  const button = screen.getByRole('button', { name: 'Complete Set' });
  await userEvent.click(button);
};

// Reaching a goal no longer logs the workout directly — it opens a confirm
// dialog; this accepts it.
const confirmGoalReached = async () => {
  const dialog = await screen.findByRole('dialog', { name: /goal reached/i });
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Finish workout' }),
  );
};

describe('reporting reps actually completed', () => {
  const logWorkout = vi.fn();

  beforeEach(() =>
    useLogWorkout.mockReturnValue({
      mutate: logWorkout,
      data: null,
      isLoading: false,
    }),
  );

  afterEach(() => vi.clearAllMocks());

  const openAdjustDialog = () =>
    userEvent.click(
      screen.getByRole('button', { name: /adjust reps completed/i }),
    );

  const completeSet = () =>
    userEvent.click(screen.getByRole('button', { name: 'Complete set' }));

  const clickMinus = async (times) => {
    const minus = screen.getByRole('button', {
      name: '- reps — Two-Arm Kettlebell Military Press',
    });
    for (let i = 0; i < times; i++) await userEvent.click(minus);
  };

  const finish = () =>
    userEvent.click(screen.getByRole('button', { name: /finish workout/i }));

  test('a max rung: Continue asks for the count instead of assuming one', async () => {
    render(<MaxReps />);

    await clickContinue();

    expect(
      screen.getByRole('heading', { name: /how many reps/i }),
    ).toBeInTheDocument();

    // Seeded at 10; 20 kg of bells makes the volume unambiguous.
    await completeSet();
    await finish();

    expect(logWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        completedReps: 10,
        completedVolume: 200,
        completedRepsByMovement: [[10]],
      }),
    );
  });

  test('a max rung: the reported count is what gets logged', async () => {
    render(<MaxReps />);

    await clickContinue();
    await clickMinus(3);
    await completeSet();
    await finish();

    expect(logWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        completedReps: 7,
        completedVolume: 140,
        completedRepsByMovement: [[7]],
      }),
    );
  });

  test('a prescribed rung: Continue advances without asking', async () => {
    render(<FixedRepsForAdjustment />);

    await clickContinue();

    expect(
      screen.queryByRole('heading', { name: /how many reps/i }),
    ).not.toBeInTheDocument();

    await finish();

    expect(logWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        completedReps: 5,
        completedRepsByMovement: [[5]],
      }),
    );
  });

  test('a prescribed rung: Adjust reps logs a short set at the count reported', async () => {
    render(<FixedRepsForAdjustment />);

    await openAdjustDialog();
    await clickMinus(2); // 3 of the 5 prescribed
    await completeSet();
    await finish();

    expect(logWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        completedReps: 3,
        completedVolume: 60,
        completedRepsByMovement: [[3]],
      }),
    );
  });

  test('intervals: no Continue press to adjust against', async () => {
    render(<IntervalTimer />);

    expect(
      screen.queryByRole('button', { name: /adjust reps completed/i }),
    ).not.toBeInTheDocument();
  });

  test('a ladder to max: prescribed rungs pass through, the max rung asks', async () => {
    render(<LadderToMaxReps />);

    // Rungs 1 and 2 are prescribed, so they complete on the press alone.
    await clickContinue();
    await clickContinue();
    expect(
      screen.queryByRole('heading', { name: /how many reps/i }),
    ).not.toBeInTheDocument();

    // The third is max, so it can't be completed without a count.
    await clickContinue();
    expect(
      screen.getByRole('heading', { name: /how many reps/i }),
    ).toBeInTheDocument();
    await completeSet();
    await finish();

    expect(logWorkout).toHaveBeenCalledWith(
      expect.objectContaining({
        completedReps: 13, // 1 + 2 + the 10 reported
        completedRepsByMovement: [[1, 2, 10]],
      }),
    );
  });

  test('a max set is marked as such, in both units', async () => {
    const { unmount } = render(<MaxReps />);
    expect(screen.getByTestId('rung-unit-label')).toHaveTextContent('Max reps');
    expect(screen.getByTestId('current-reps')).toHaveTextContent('∞');
    unmount();

    render(<MaxTimedRung />);
    expect(screen.getByTestId('rung-unit-label')).toHaveTextContent('Max time');
    // The clock moves, so ∞ is what keeps it reading as to-failure.
    expect(screen.getByTestId('current-reps')).toHaveTextContent('∞');
    expect(screen.getByTestId('hold-elapsed')).toBeInTheDocument();
  });

  test('a prescribed rung is not marked max', () => {
    render(<FixedRepsForAdjustment />);

    expect(screen.getByTestId('rung-unit-label')).toHaveTextContent('Reps');
    expect(screen.getByTestId('rung-unit-label')).not.toHaveTextContent('Max');
    expect(screen.getByTestId('current-reps')).not.toHaveTextContent('∞');
  });

  test('a max timed rung: the press records the hold, with no dialog', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<MaxTimedRung />);

      await act(async () => {
        vi.advanceTimersByTime(8000);
      });

      await clickContinue();

      expect(
        screen.queryByRole('heading', { name: /how many reps/i }),
      ).not.toBeInTheDocument();

      await finish();
    } finally {
      vi.useRealTimers();
    }

    const [[logged]] = logWorkout.mock.calls;
    const [[held]] = logged.completedRepsByMovement;
    // The hold is measured, not prescribed, so assert the band rather than a
    // brittle exact tick.
    expect(held).toBeGreaterThanOrEqual(7);
    expect(held).toBeLessThanOrEqual(9);
    // Seconds are not reps: a timed rung still contributes neither.
    expect(logged.completedReps).toBe(0);
    expect(logged.completedVolume).toBe(0);
  });
});
