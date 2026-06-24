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

  test('renders all seven patterns and the overall balance once unlocked', () => {
    render(<WeeklyBalance balance={balance} workoutCount={5} />);
    expect(screen.getByText('Hinge')).toBeInTheDocument();
    expect(screen.getByText('Get-up')).toBeInTheDocument();
    // hinge is the only trained pattern -> the user is hinge-heavy
    expect(screen.getByText('Hinge-heavy')).toBeInTheDocument();
  });

  test('tapping a pattern reveals its drill-down detail', () => {
    render(<WeeklyBalance balance={balance} workoutCount={5} />);
    expect(screen.queryByText('Debt score')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Hinge/i }));
    expect(screen.getByText('Debt score')).toBeInTheDocument();
    expect(screen.getByText('Last trained')).toBeInTheDocument();
  });
});
