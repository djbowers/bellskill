import { fireEvent, render, screen } from '@testing-library/react';

import { MovementAggregate, computeModalityBalance } from '~/utils';

import { ModalityBalance } from './ModalityBalance';

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

const balance = computeModalityBalance([
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
]);

const mixedBalance = computeModalityBalance([
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
]);

describe('ModalityBalance', () => {
  test('shows the cold-start state below the workout threshold', () => {
    render(<ModalityBalance balance={balance} workoutCount={1} />);
    expect(screen.getByText(/1 of 3 logged/i)).toBeInTheDocument();
    expect(screen.queryByText('Grind')).not.toBeInTheDocument();
  });

  test('shows a loading state', () => {
    render(<ModalityBalance workoutCount={0} isLoading />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('shows an error state with a retry action', () => {
    const onRetry = vi.fn();
    render(<ModalityBalance workoutCount={0} isError onRetry={onRetry} />);
    expect(screen.getByText(/couldn.t load/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('renders all four modalities and a next-focus prescription once unlocked', () => {
    render(<ModalityBalance balance={balance} workoutCount={5} />);
    expect(screen.getByText('Grind')).toBeInTheDocument();
    expect(screen.getByText('Ballistic')).toBeInTheDocument();
    expect(screen.getByText('Cardio')).toBeInTheDocument();
    expect(screen.getByText('Mobility')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByText("You're on track")).toBeInTheDocument();
  });

  test('surfaces a neglected trained modality as needing work', () => {
    render(<ModalityBalance balance={mixedBalance} workoutCount={5} />);
    expect(screen.getByText(/ballistic needs work/i)).toBeInTheDocument();
  });

  test('multi-credit movement lights up both credited modalities', () => {
    render(<ModalityBalance balance={mixedBalance} workoutCount={5} />);
    expect(
      screen.queryByRole('button', { name: /Ballistic: new/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Cardio: new/i }),
    ).not.toBeInTheDocument();
  });

  test('renders untrained modalities as a New state', () => {
    render(<ModalityBalance balance={balance} workoutCount={5} />);
    const row = screen.getByRole('button', {
      name: /Ballistic: new, not trained yet/i,
    });
    expect(row).toHaveTextContent('New');
    expect(row).toHaveTextContent('—');
  });

  test('expanding a New row shows the not-trained-yet prompt instead of the detail grid', () => {
    render(<ModalityBalance balance={balance} workoutCount={5} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Mobility: new, not trained yet/i }),
    );
    expect(
      screen.getByText(/log any mobility movement to start tracking/i),
    ).toBeInTheDocument();
  });

  test('tapping a trained modality reveals its drill-down detail', () => {
    render(<ModalityBalance balance={balance} workoutCount={5} />);
    expect(screen.queryByText('Balance')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Grind/i }));
    expect(screen.getByText('Balance')).toBeInTheDocument();
    expect(screen.getByText('Last trained')).toBeInTheDocument();
    expect(screen.getByText('Effort')).toBeInTheDocument();
    expect(screen.getByText('Hard')).toBeInTheDocument();
  });
});
