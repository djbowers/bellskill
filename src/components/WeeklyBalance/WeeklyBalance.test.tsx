import { fireEvent, render, screen } from '@testing-library/react';

import { PatternAggregate, computePatternBalance } from '~/utils';

import { WeeklyBalance } from './WeeklyBalance';

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const balance = computePatternBalance([
  {
    pattern: 'hinge',
    last_trained_at: daysAgo(1),
    set_count: 9,
    total_reps: 45,
    total_volume_kg: 1200,
    baseline_volume_kg: 1000,
    hardest_rpe: 'hard',
  } as PatternAggregate,
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

  test('renders all seven patterns and a next-focus prescription once unlocked', () => {
    render(<WeeklyBalance balance={balance} workoutCount={5} />);
    expect(screen.getByText('Hinge')).toBeInTheDocument();
    expect(screen.getByText('Get-up')).toBeInTheDocument();
    // hinge is the only trained pattern -> a neglected one is surfaced to train
    expect(screen.getByText(/needs work/i)).toBeInTheDocument();
  });

  test('ranks the most-neglected pattern first and the freshest last', () => {
    render(<WeeklyBalance balance={balance} workoutCount={5} />);
    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Squat');
    expect(rows[rows.length - 1]).toHaveTextContent('Hinge');
  });

  test('shows compact recency for a trained pattern', () => {
    render(<WeeklyBalance balance={balance} workoutCount={5} />);
    expect(screen.getByRole('button', { name: /Hinge/i })).toHaveTextContent(
      '1d',
    );
  });

  test('tapping a pattern reveals its drill-down detail', () => {
    render(<WeeklyBalance balance={balance} workoutCount={5} />);
    expect(screen.queryByText('Readiness')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Hinge/i }));
    expect(screen.getByText('Readiness')).toBeInTheDocument();
    expect(screen.getByText('Last trained')).toBeInTheDocument();
    // Hinge's hardest recent session was rated Hard.
    expect(screen.getByText('Effort')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
  });
});
