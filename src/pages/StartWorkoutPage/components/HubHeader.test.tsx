import { render, screen } from '@testing-library/react';

import { HubHeader } from './HubHeader';

describe('HubHeader', () => {
  test('no workout yet', () => {
    render(<HubHeader lastWorkoutAt={null} />);
    expect(screen.getByText("Let's get your first workout in.")).toBeVisible();
  });

  test('trained earlier today', () => {
    const now = new Date(2026, 5, 24, 9, 0, 0);
    render(<HubHeader lastWorkoutAt={new Date(2026, 5, 24, 6, 0, 0)} now={now} />);
    expect(screen.getByText('You already trained today. Nice.')).toBeVisible();
  });

  test('trained yesterday evening, less than 24h ago, still reads as yesterday', () => {
    const now = new Date(2026, 5, 24, 8, 0, 0);
    const lastWorkoutAt = new Date(2026, 5, 23, 20, 0, 0);
    render(<HubHeader lastWorkoutAt={lastWorkoutAt} now={now} />);
    expect(screen.getByText('Last trained yesterday.')).toBeVisible();
  });

  test('trained several days ago', () => {
    const now = new Date(2026, 5, 24, 9, 0, 0);
    const lastWorkoutAt = new Date(2026, 5, 20, 9, 0, 0);
    render(<HubHeader lastWorkoutAt={lastWorkoutAt} now={now} />);
    expect(screen.getByText('Last trained 4 days ago.')).toBeVisible();
  });
});
