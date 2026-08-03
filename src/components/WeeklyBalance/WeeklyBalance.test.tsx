import { fireEvent, render, screen } from '@testing-library/react';

import { MovementAggregate, computePatternBalance } from '~/utils';

import { WeeklyBalance } from './WeeklyBalance';

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const balance = computePatternBalance([
  {
    movement_id: 'movement-1',
    movement_name: 'Hinge Swing',
    pattern_credits: ['hinge'],
    last_trained_at: daysAgo(1),
    set_count: 9,
    total_reps: 45,
    total_volume_kg: 1200,
    baseline_volume_kg: 1000,
    hardest_rpe: 'hard',
  } as MovementAggregate,
]);

const mixedBalance = computePatternBalance([
  {
    movement_id: 'movement-1',
    movement_name: 'Hinge Swing',
    pattern_credits: ['hinge'],
    last_trained_at: daysAgo(1),
    set_count: 9,
    total_reps: 45,
    total_volume_kg: 1200,
    baseline_volume_kg: 1000,
    hardest_rpe: 'hard',
  } as MovementAggregate,
  {
    movement_id: 'movement-2',
    movement_name: 'Squat',
    pattern_credits: ['squat'],
    last_trained_at: daysAgo(20),
    set_count: 3,
    total_reps: 15,
    total_volume_kg: 100,
    baseline_volume_kg: 1000,
    hardest_rpe: 'easy',
  } as MovementAggregate,
]);

describe('WeeklyBalance', () => {
  test('shows the cold-start state below the workout threshold', () => {
    render(<WeeklyBalance balance={balance} workoutCount={1} />);
    expect(screen.getByText(/1 of 3 logged/i)).toBeInTheDocument();
    expect(screen.queryByText('Hinge')).not.toBeInTheDocument();
  });

  test('shows a loading state', () => {
    render(<WeeklyBalance workoutCount={0} isLoading />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('shows an error state with a retry action', () => {
    const onRetry = vi.fn();
    render(<WeeklyBalance workoutCount={0} isError onRetry={onRetry} />);
    expect(screen.getByText(/couldn.t load/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('renders all eight patterns and a next-focus prescription once unlocked', () => {
    render(<WeeklyBalance balance={balance} workoutCount={5} />);
    expect(screen.getByText('Hinge')).toBeInTheDocument();
    expect(screen.getByText('Core')).toBeInTheDocument();
    expect(screen.getByText('Get-up')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(8);
    // hinge is the only trained pattern and it's on track; every other
    // pattern is new (never logged) so there's nothing overdue to surface.
    expect(screen.getByText("You're on track")).toBeInTheDocument();
  });

  test('surfaces a neglected trained pattern as needing work', () => {
    render(<WeeklyBalance balance={mixedBalance} workoutCount={5} />);
    expect(screen.getByText(/squat needs work/i)).toBeInTheDocument();
  });

  test('ranks the only trained pattern first', () => {
    render(<WeeklyBalance balance={balance} workoutCount={5} />);
    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Hinge');
  });

  test('shows compact recency for a trained pattern', () => {
    render(<WeeklyBalance balance={balance} workoutCount={5} />);
    expect(screen.getByRole('button', { name: /Hinge/i })).toHaveTextContent(
      '1d',
    );
  });

  test('renders untrained patterns as a New state', () => {
    render(<WeeklyBalance balance={balance} workoutCount={5} />);
    const squatRow = screen.getByRole('button', {
      name: /Squat: new, not trained yet/i,
    });
    expect(squatRow).toHaveTextContent('New');
    expect(squatRow).toHaveTextContent('—');
  });

  test('expanding a New row shows the not-trained-yet prompt instead of the detail grid', () => {
    render(<WeeklyBalance balance={balance} workoutCount={5} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Squat: new, not trained yet/i }),
    );
    expect(
      screen.getByText(/log any squat movement to start tracking/i),
    ).toBeInTheDocument();
  });

  test('tapping a trained pattern reveals its drill-down detail', () => {
    render(<WeeklyBalance balance={balance} workoutCount={5} />);
    expect(screen.queryByText('Balance')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Hinge/i }));
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('Last trained')).toBeInTheDocument();
    // Hinge's hardest recent session was rated Hard.
    expect(screen.getByText('Effort')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
  });
});
