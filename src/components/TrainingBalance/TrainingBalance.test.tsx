import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  MovementAggregate,
  computeModalityBalance,
  computePatternBalance,
} from '~/utils';

import { TrainingBalance } from './TrainingBalance';

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const aggregates = [
  {
    movement_id: 'movement-1',
    movement_name: 'Kettlebell Military Press',
    pattern_credits: ['push'],
    modality_credits: ['grind'],
    last_trained_at: daysAgo(1),
    set_count: 9,
    total_reps: 45,
    total_volume_kg: 1200,
    baseline_volume_kg: 1000,
    hardest_rpe: 'hard',
  } as MovementAggregate,
  {
    movement_id: 'movement-2',
    movement_name: 'Kettlebell Swing',
    pattern_credits: ['hinge'],
    modality_credits: ['ballistic', 'conditioning'],
    last_trained_at: daysAgo(20),
    set_count: 3,
    total_reps: 15,
    total_volume_kg: 100,
    baseline_volume_kg: 1000,
    hardest_rpe: 'easy',
  } as MovementAggregate,
];

const patternBalance = computePatternBalance(aggregates);
const modalityBalance = computeModalityBalance(aggregates);

describe('TrainingBalance', () => {
  test('shows the cold-start state below the workout threshold', () => {
    render(
      <TrainingBalance
        patternBalance={patternBalance}
        modalityBalance={modalityBalance}
        workoutCount={1}
      />,
    );
    expect(screen.getByText(/1 of 3 logged/i)).toBeInTheDocument();
    expect(screen.queryByText('Hinge')).not.toBeInTheDocument();
  });

  test('shows a loading state', () => {
    render(<TrainingBalance workoutCount={0} isLoading />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('shows an error state with a retry action', () => {
    const onRetry = vi.fn();
    render(<TrainingBalance workoutCount={0} isError onRetry={onRetry} />);
    expect(screen.getByText(/couldn.t load/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('defaults to the Patterns tab with all eight patterns', () => {
    render(
      <TrainingBalance
        patternBalance={patternBalance}
        modalityBalance={modalityBalance}
        workoutCount={5}
      />,
    );
    expect(screen.getByText('Hinge')).toBeInTheDocument();
    expect(screen.getByText('Get-up')).toBeInTheDocument();
    expect(screen.queryByText('Grind')).not.toBeInTheDocument();
    // The swing went stale, so hinge is the pattern most in need.
    expect(screen.getByText(/hinge needs work/i)).toBeInTheDocument();
  });

  test('switching to the Training Mix tab shows the four modalities', async () => {
    render(
      <TrainingBalance
        patternBalance={patternBalance}
        modalityBalance={modalityBalance}
        workoutCount={5}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: /training mix/i }));
    expect(screen.getByText('Grind')).toBeInTheDocument();
    expect(screen.getByText('Ballistic')).toBeInTheDocument();
    expect(screen.getByText('Cardio')).toBeInTheDocument();
    expect(screen.getByText('Mobility')).toBeInTheDocument();
    expect(screen.queryByText('Hinge')).not.toBeInTheDocument();
    expect(screen.getByText(/ballistic needs work/i)).toBeInTheDocument();
  });

  test('renders patterns without tabs when modalities are disabled', () => {
    render(
      <TrainingBalance
        patternBalance={patternBalance}
        showModalities={false}
        workoutCount={5}
      />,
    );
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByText('Hinge')).toBeInTheDocument();
  });

  test('renders modalities without tabs when patterns are disabled', () => {
    render(
      <TrainingBalance
        modalityBalance={modalityBalance}
        showPatterns={false}
        workoutCount={5}
      />,
    );
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByText('Grind')).toBeInTheDocument();
  });

  test('renders untrained rows as a New state', () => {
    render(
      <TrainingBalance
        patternBalance={patternBalance}
        modalityBalance={modalityBalance}
        workoutCount={5}
      />,
    );
    const row = screen.getByRole('button', {
      name: /Squat: new, not trained yet/i,
    });
    expect(row).toHaveTextContent('New');
  });

  test('tapping a trained row reveals its drill-down detail', () => {
    render(
      <TrainingBalance
        patternBalance={patternBalance}
        modalityBalance={modalityBalance}
        workoutCount={5}
      />,
    );
    expect(screen.queryByText('Last trained')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Push/i }));
    expect(screen.getByText('Last trained')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
  });

  test('Balance me out lives in the Patterns tab and fires the callback', async () => {
    const onBalanceMe = vi.fn();
    render(
      <TrainingBalance
        patternBalance={patternBalance}
        modalityBalance={modalityBalance}
        workoutCount={5}
        onBalanceMe={onBalanceMe}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /balance me out/i }));
    expect(onBalanceMe).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('tab', { name: /training mix/i }));
    expect(
      screen.queryByRole('button', { name: /balance me out/i }),
    ).not.toBeInTheDocument();
  });
});
