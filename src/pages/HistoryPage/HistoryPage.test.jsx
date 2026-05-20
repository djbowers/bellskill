import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';

import * as stories from './HistoryPage.stories';

const { Default } = composeStories(stories);

describe('workout history page', () => {
  beforeEach(() => {
    render(<Default />);
  });

  test('renders name of movement', async () => {
    await screen.findAllByText('Clean and Press', { exact: false });
  });

  test('renders workout details', async () => {
    await screen.findAllByText('The Giant', { exact: false });
  });

  test('renders workout volume', async () => {
    await screen.findByText('1000 kg');
  });

  test('renders workout date', async () => {
    await screen.findByText('Thu Nov 09 2023');
  });

  test('renders rep count for bodyweight workouts', async () => {
    await screen.findByText('50 reps');
  });

  test('renders Complex badge for workouts with complex_set true', async () => {
    await screen.findByText('Complex');
  });

  test('does not render Complex badge for workouts without complex_set', async () => {
    await screen.findByText('50 reps');
    const badges = screen.getAllByText('Complex');
    expect(badges).toHaveLength(1);
  });
});
