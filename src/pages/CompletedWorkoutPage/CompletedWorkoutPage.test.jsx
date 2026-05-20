import { composeStories } from '@storybook/react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useDeleteWorkoutLog } from '~/api';

import * as stories from './CompletedWorkoutPage.stories';

const { Default } = composeStories(stories);

describe('completed workout page', () => {
  vi.mock('~/api', async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      useDeleteWorkoutLog: vi.fn(),
    };
  });

  const deleteWorkoutLog = vi.fn();

  beforeEach(() => {
    useDeleteWorkoutLog.mockReturnValue({
      mutate: deleteWorkoutLog,
      isLoading: false,
    });
  });

  afterEach(() => vi.clearAllMocks());

  test('renders the completed workout history item', async () => {
    render(<Default />);

    await screen.findByTestId('workout-history-item');
  });

  test('renders Complex badge in header when workout is complex', async () => {
    render(<Default />);

    await screen.findByText('Complex');
  });

  test('clicking on an RPE value updates the selected value', async () => {
    render(<Default />);

    const idealOption = await screen.findByRole('radio', { name: 'Ideal' });
    const hardOption = screen.getByRole('radio', { name: 'Hard' });

    expect(idealOption).toBeChecked();
    expect(hardOption).not.toBeChecked();

    await userEvent.click(hardOption);

    expect(idealOption).not.toBeChecked();
    expect(hardOption).toBeChecked();
  });

  test('users can enter post-workout notes', async () => {
    render(<Default />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Add Notes' }),
    );

    const notesInput = await screen.findByRole('textbox', {
      name: 'Workout Notes',
    });

    await userEvent.type(notesInput, 'These are my notes');
    fireEvent.blur(notesInput);

    expect(notesInput).toHaveValue('These are my notes');
  });

  test('users can delete a workout log', async () => {
    render(<Default />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Delete' }),
    );

    const dialog = screen.getByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' }),
    );

    expect(deleteWorkoutLog).toHaveBeenCalled();
  });
});
