import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';

import * as stories from './WorkoutHistoryItem.stories';

const { Default, RoundsGoal, ComplexSet, CatalogLinkedLongName, Bodyweight } =
  composeStories(stories);

vi.setSystemTime(new Date('2024-01-02T12:00:00'));

describe('hero metric', () => {
  test('displays total volume and round/rep summary', async () => {
    render(<Default />);
    expect(screen.getByText('You moved')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(
      screen.getByText('across 10 rounds · 50 reps'),
    ).toBeInTheDocument();
  });

  test('displays workout goal pill', async () => {
    render(<RoundsGoal />);
    expect(screen.getByText('15 ROUNDS GOAL')).toBeInTheDocument();
  });

  test('displays workout details when provided', async () => {
    render(<Default />);
    await screen.findByText('The Giant 3.0 W1D2');
  });
});

describe('movement rows', () => {
  test('displays movements with compact rep scheme and per-movement volume', async () => {
    render(<Default />);
    await screen.findByText('Single Arm Front Squat');
    await screen.findByText('Single Arm Overhead Press');
    expect(screen.getAllByText(/5 reps . 10/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/800 kg/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/×50/).length).toBeGreaterThanOrEqual(2);
  });

  test('omits per-movement volume for bodyweight movements', async () => {
    render(<Bodyweight />);
    expect(screen.getByText(/×50/)).toBeInTheDocument();
    expect(screen.queryByText(/\d+ kg/)).not.toBeInTheDocument();
  });
});

describe('complex set workouts', () => {
  test('displays carried weights block without per-movement weights', async () => {
    render(<ComplexSet />);

    expect(screen.getByText('Carried')).toBeInTheDocument();
    expect(screen.getByText('24 kg')).toBeInTheDocument();
    expect(screen.getByText('shared across the complex')).toBeInTheDocument();
    expect(screen.queryByText('800 kg')).not.toBeInTheDocument();
  });
});

describe('movement linking', () => {
  test('shows cataloged badge with unlink control for linked movements', async () => {
    render(<CatalogLinkedLongName />);
    expect(screen.getByText('Cataloged')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Unlink from catalog' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Link to catalog' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Double Kettlebell Push Press'),
    ).toBeInTheDocument();
  });
});
