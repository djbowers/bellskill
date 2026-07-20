import { composeStories } from '@storybook/react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { useLogWorkout } from '~/api';

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
  RepLadders,
  TwoHanded,
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
} = composeStories(stories);

describe('finishing a workout', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
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
      completedReps: expect.any(Number),
      completedRounds: expect.any(Number),
      completedRungs: expect.any(Number),
      completedSides: expect.any(Number),
      completedVolume: expect.any(Number),
    });
  });

  test('automatically finishes when reaching workout goal', async () => {
    const { workoutOptions } = WorkoutGoalRounds.parameters;
    render(<WorkoutGoalRounds />);

    // Complete all rounds
    for (let i = 0; i < workoutOptions.workoutGoal; i++) {
      await clickContinue();
    }

    // Should call logWorkout mutation
    expect(logWorkout).toHaveBeenCalledWith({
      completedReps: expect.any(Number),
      completedRounds: expect.any(Number),
      completedRungs: expect.any(Number),
      completedSides: expect.any(Number),
      completedVolume: expect.any(Number),
    });
  });

  test('logs correct volume when using pounds as weight units', async () => {
    render(<WeightUnitsPounds />);

    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 34,
    });
  });
});

describe('integration tests for previous volume persistence', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
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
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 120,
    });
  });

  test('stores completed volume when workout finishes automatically with volume goal', async () => {
    render(<VolumeGoalExactMatch />);

    // Complete one set: 24kg × 5 reps = 120kg (exactly matches goal)
    await clickContinue();

    // Should automatically call logWorkout with completedVolume
    expect(logWorkout).toHaveBeenCalledWith({
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 120,
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
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 120, // 120.4 rounds to 120
    });
  });
});

describe('volume calculation with kilogram weights', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
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
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 120,
    });
  });

  test('calculates volume correctly for double weights ((16kg + 12kg) × 5 reps = 140kg)', async () => {
    render(<DoubleWeights16And12Kg />);

    await clickContinue();

    await userEvent.click(
      screen.getByRole('button', { name: /finish workout/i }),
    );

    expect(logWorkout).toHaveBeenCalledWith({
      completedReps: 5,
      completedRounds: 0,
      completedRungs: 0,
      completedSides: expect.any(Number),
      completedVolume: 140,
    });
  });
});

describe('volume calculation with pound weights', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
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
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: expect.any(Number),
    });

    // Verify conversion accuracy: 53lb × 0.453592 × 5 reps ≈ 120.2kg (rounded to 120)
    const actualVolume = logWorkout.mock.calls[0][0].completedVolume;
    expect(actualVolume).toBeCloseTo(120, 0);
  });
});

describe('volume calculation with mixed weight units', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
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
      completedReps: 5,
      completedRounds: 0,
      completedRungs: 0,
      completedSides: expect.any(Number),
      completedVolume: expect.any(Number),
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
      completedReps: 5,
      completedRounds: 0,
      completedRungs: 0,
      completedSides: expect.any(Number),
      completedVolume: expect.any(Number),
    });

    // Verify: (35 × 0.453592 + 12) × 5 ≈ 139kg (rounded)
    const actualVolume = logWorkout.mock.calls[0][0].completedVolume;
    expect(actualVolume).toBeCloseTo(139, 0);
  });
});

describe('volume calculation with one-handed movements', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
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
      completedReps: 5,
      completedRounds: 0,
      completedRungs: 0,
      completedSides: 1, // finished one side of the one-handed movement
      completedVolume: 80,
    });
  });
});

describe('volume calculation with bodyweight movements', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
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
      completedReps: 5,
      completedRounds: 0,
      completedRungs: 0,
      completedSides: expect.any(Number),
      completedVolume: 0,
    });
  });
});

describe('volume accumulation across multiple rungs', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
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
      completedReps: 6, // 1 + 2 + 3
      completedRounds: 1,
      completedRungs: 3,
      completedSides: 3, // two-handed: one side per rung across [1, 2, 3]
      completedVolume: 96, // 16 + 32 + 48
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

    // Should automatically call logWorkout mutation
    expect(logWorkout).toHaveBeenCalledWith({
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 120,
    });
  });

  test('automatically finishes when volume goal is exceeded', async () => {
    render(<VolumeGoalExceeded />);

    // Complete one set: 24kg × 5 reps = 120kg (exceeds goal of 100kg)
    await clickContinue();

    // Should automatically call logWorkout mutation
    expect(logWorkout).toHaveBeenCalledWith({
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 120,
    });
  });
});

describe('volume rounding on workout completion', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
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
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 120, // 120.4 rounds down to 120
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
      completedReps: 5,
      completedRounds: 1,
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 121, // 120.6 rounds up to 121
    });
  });
});

describe('volume does not trigger completion for non-volume goals', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
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
        completedReps: 5,
        completedRounds: 1,
        completedRungs: 1,
        completedSides: expect.any(Number),
        completedVolume: 0,
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
        completedReps: 15,
        completedRounds: 3,
        completedRungs: 3,
        completedSides: expect.any(Number),
        completedVolume: 360,
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
        completedReps: 5,
        completedRounds: 1,
        completedRungs: 1,
        completedSides: expect.any(Number),
        completedVolume: 123,
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
        completedReps: 15,
        completedRounds: 3,
        completedRungs: 3,
        completedSides: expect.any(Number),
        completedVolume: 369,
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
        completedReps: 10,
        completedRounds: 2,
        completedRungs: 2,
        completedSides: expect.any(Number),
        completedVolume: 246,
      });
    });
  });
});

describe('volume calculation for complex mode', () => {
  vi.mock('~/api', () => ({
    useLogWorkout: vi.fn(),
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
      completedReps: 15, // 5 + 5 + 5
      completedRounds: 0, // still in round 1 (only 1 of 5 rungs done)
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 360,
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
      completedReps: 45, // (5+4+3+2+1) × 3 movements
      completedRounds: 1,
      completedRungs: 5,
      completedSides: expect.any(Number),
      completedVolume: 1080,
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
    await clickCompleteSet(); // round 5 → rounds goal reached, auto-finish

    // No manual "finish workout" click needed — the rounds goal ends it.
    // Per round: (2+1+3) reps = 6; double 24kg bells = 48kg/movement.
    // Volume/round = 48×(2+1+3) = 288kg; ×5 rounds = 1440kg.
    expect(logWorkout).toHaveBeenCalledWith({
      completedReps: 30, // 6 reps × 5 rounds
      completedRounds: 5,
      completedRungs: 5, // 1 rung per round × 5
      completedSides: expect.any(Number),
      completedVolume: 1440,
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
      completedReps: 10, // 5 + 5
      completedRounds: 1, // repScheme [5] has 1 rung — round completes on first press
      completedRungs: 1,
      completedSides: expect.any(Number),
      completedVolume: 360,
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

describe('active workout page (Armor Building Complex seed session)', () => {
  const { workoutOptions } = ArmorBuildingComplex.parameters;

  beforeEach(() => {
    render(<ArmorBuildingComplex />);
  });

  test('flows all three movements as one chain with reps 2, 1, 3', () => {
    // clean → press → squat shown together, each at its single rung.
    expect(workoutOptions.movements.map((m) => m.movementName)).toEqual([
      'Two-Arm Kettlebell Clean',
      'Two-Arm Kettlebell Military Press',
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

const clickContinue = async () => {
  const continueButton = screen.getByRole('button', { name: 'Continue' });
  await userEvent.click(continueButton);
};

const clickCompleteSet = async () => {
  const button = screen.getByRole('button', { name: 'Complete Set' });
  await userEvent.click(button);
};
