import { composeStories } from '@storybook/react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useDeleteWorkoutLog } from '~/api';

import * as stories from './CompletedWorkoutPage.stories';

const { Default, JustFinished } = composeStories(stories);

const navigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

describe('completed workout page', () => {
  vi.mock('~/api', async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      useDeleteWorkoutLog: vi.fn(),
    };
  });

  const deleteWorkoutLog = vi.fn();
  const updateWorkoutOptions = vi.fn();

  beforeEach(() => {
    useDeleteWorkoutLog.mockReturnValue({
      mutate: deleteWorkoutLog,
      isLoading: false,
    });
    Default.parameters.updateWorkoutOptions = updateWorkoutOptions;
  });

  afterEach(() => vi.clearAllMocks());

  test('renders the completed workout history item', async () => {
    render(<Default />);

    await screen.findByTestId('workout-history-item');
  });

  test('leads with the outcome stats of the session', async () => {
    render(<Default />);

    const headline = await screen.findByTestId('headline-stats');
    expect(headline).toHaveTextContent('21m');
    expect(headline).toHaveTextContent('9');
    expect(headline).toHaveTextContent('54');
    expect(headline).toHaveTextContent('1000 kg');
  });

  test('celebrates a just-finished workout and hides Delete', async () => {
    render(<JustFinished />);

    await screen.findByText('Workout complete');
    expect(
      screen.queryByRole('button', { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  test('shows the archival title and Delete when visited from history', async () => {
    render(<Default />);

    await screen.findByText('Workout Log');
    expect(
      await screen.findByRole('button', { name: /delete/i }),
    ).toBeInTheDocument();
  });

  test('renders Complex badge in header when workout is complex', async () => {
    render(<Default />);

    await screen.findByText('Complex');
  });

  test('clicking Repeat on a complex workout restores complex set and shared weights', async () => {
    render(<Default />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Repeat' }),
    );

    expect(updateWorkoutOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        complexSet: true,
        sharedWeightOneUnit: 'kilograms',
        sharedWeightOneValue: 20,
        sharedWeightTwoUnit: 'kilograms',
        sharedWeightTwoValue: 16,
        movements: [
          expect.objectContaining({
            movementName: 'Clean and Press',
            repScheme: [3],
            weightOneUnit: 'kilograms',
            weightOneValue: 20,
            weightTwoUnit: 'kilograms',
            weightTwoValue: 16,
          }),
          expect.objectContaining({
            movementName: 'Front Squat',
            repScheme: [1, 2, 3],
            weightOneUnit: 'kilograms',
            weightOneValue: 20,
            weightTwoUnit: 'kilograms',
            weightTwoValue: 16,
          }),
        ],
      }),
    );
    expect(navigate).toHaveBeenCalledWith('/', {
      state: { editWorkout: true },
    });
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
