import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { RepeatableWorkout } from '~/api';

import { RecommendedWorkoutsSection } from './RecommendedWorkoutsSection';

const repeat = (id: string, title: string): RepeatableWorkout =>
  ({
    workoutLogId: id,
    workoutLog: { title },
    workoutOptions: {
      movements: [{ movementName: 'Two-Hand Swing' }],
      workoutGoal: 10,
      workoutGoalUnits: 'minutes',
    },
  }) as unknown as RepeatableWorkout;

const renderSection = (props = {}) =>
  render(
    <RecommendedWorkoutsSection
      curated={[]}
      recentRepeats={[repeat('log-1', 'Simple & Sinister'), repeat('log-2', 'EMOM 20')]}
      isFirstWorkout={false}
      onSelectCurated={vi.fn()}
      onSelectRepeat={vi.fn()}
      {...props}
    />,
  );

describe('RecommendedWorkoutsSection — repeat collapse', () => {
  test('collapsed by default: header and count show, cards do not', () => {
    renderSection();

    expect(screen.getByText('Pick up where you left off')).toBeInTheDocument();
    expect(screen.getByText('2 recent workouts')).toBeInTheDocument();
    expect(screen.queryByText('Simple & Sinister')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /expand recent workouts/i }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  test('expanding reveals the repeat cards and hides the count', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(
      screen.getByRole('button', { name: /expand recent workouts/i }),
    );

    expect(screen.getByText('Simple & Sinister')).toBeInTheDocument();
    expect(screen.getByText('EMOM 20')).toBeInTheDocument();
    expect(screen.queryByText('2 recent workouts')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /collapse recent workouts/i }),
    ).toHaveAttribute('aria-expanded', 'true');
  });

  test('repeatsDefaultOpen starts expanded (no-program hub)', () => {
    renderSection({ repeatsDefaultOpen: true });
    expect(screen.getByText('Simple & Sinister')).toBeInTheDocument();
  });
});
