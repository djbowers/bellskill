import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { CuratedWorkout } from '~/types';

import { RecommendedWorkoutsSection } from './RecommendedWorkoutsSection';

const curatedWorkout = {
  id: 'curated-1',
  title: 'Simple & Sinister',
  subtitle: 'Swings and get-ups',
  estimatedMinutes: 20,
  workoutOptions: {
    movements: [{ movementName: 'Two-Hand Swing' }],
    workoutGoal: 10,
    workoutGoalUnits: 'minutes',
  },
} as unknown as CuratedWorkout;

const renderSection = (props = {}) =>
  render(
    <RecommendedWorkoutsSection
      curated={[curatedWorkout]}
      isFirstWorkout={false}
      onSelectCurated={vi.fn()}
      {...props}
    />,
  );

describe('RecommendedWorkoutsSection', () => {
  test('heads the list with the returning-user label', () => {
    renderSection();

    expect(
      screen.getByRole('heading', { name: 'Recommended sessions' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Simple & Sinister/ }),
    ).toBeInTheDocument();
  });

  test('heads the list with the first-workout label for a new user', () => {
    renderSection({ isFirstWorkout: true });

    expect(
      screen.getByRole('heading', { name: 'Your recommended first workout' }),
    ).toBeInTheDocument();
  });

  test('selecting a card hands the workout back to the page', async () => {
    const onSelectCurated = vi.fn();
    renderSection({ onSelectCurated });

    await userEvent.click(
      screen.getByRole('button', { name: /Simple & Sinister/ }),
    );

    expect(onSelectCurated).toHaveBeenCalledWith(curatedWorkout);
  });

  test('renders nothing without curated workouts', () => {
    const { container } = renderSection({ curated: [] });

    expect(container).toBeEmptyDOMElement();
  });
});
