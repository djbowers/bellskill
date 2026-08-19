import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';

import * as stories from './WorkoutProgress.stories';

const {
  VolumeGoalNoProgress,
  VolumeGoal25PercentComplete,
  VolumeGoal50PercentComplete,
  VolumeGoal75PercentComplete,
  VolumeGoal100PercentComplete,
  VolumeGoalExceeded,
  VolumeGoalSignificantlyExceeded,
  VolumeGoalLargeValues,
  VolumeGoalLargeValuesHalfway,
  VolumeGoalVeryLargeValues,
  VolumeGoalZero,
  TimeGoal,
  RoundsGoal,
  RoundsGoalWithInterval,
  SetsRemaining,
} = composeStories(stories);

describe('WorkoutProgress - pause button', () => {
  const pauseButton = () =>
    screen.queryByRole('button', { name: 'Pause workout' });

  test('shows pause for a minutes goal', () => {
    render(<TimeGoal />);

    expect(pauseButton()).toBeInTheDocument();
  });

  test('shows pause for a rounds goal with an interval timer', () => {
    render(<RoundsGoalWithInterval />);

    expect(pauseButton()).toBeInTheDocument();
  });

  test('hides pause for a rounds goal without an interval timer', () => {
    render(<RoundsGoal />);

    expect(pauseButton()).not.toBeInTheDocument();
  });
});

describe('WorkoutProgress - sets', () => {
  test('counts sets remaining when a set count is supplied', () => {
    render(<SetsRemaining />);

    expect(screen.getByText('sets remaining')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument(); // 15 - 7
    expect(screen.queryByText('rounds remaining')).not.toBeInTheDocument();
  });

  test('falls back to rounds when no set count is supplied', () => {
    render(<RoundsGoal />);

    expect(screen.getByText('rounds remaining')).toBeInTheDocument();
    expect(screen.queryByText('sets remaining')).not.toBeInTheDocument();
  });

  test('never reports negative sets remaining', () => {
    render(<SetsRemaining completedSets={20} totalSets={15} />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

describe('WorkoutProgress - volume goals', () => {
  describe('progress percentage calculation', () => {
    test('displays 100% remaining when no volume completed (0%)', () => {
      render(<VolumeGoalNoProgress />);

      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    test('displays 75% remaining when 25% complete', () => {
      render(<VolumeGoal25PercentComplete />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    test('displays 50% remaining when 50% complete', () => {
      render(<VolumeGoal50PercentComplete />);

      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    test('displays 25% remaining when 75% complete', () => {
      render(<VolumeGoal75PercentComplete />);

      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    test('displays 0% remaining when 100% complete', () => {
      render(<VolumeGoal100PercentComplete />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('progress description with volume goals', () => {
    test('displays "volume remaining" when workoutGoalUnits is kilograms', () => {
      render(<VolumeGoal50PercentComplete />);

      expect(screen.getByText('volume remaining')).toBeInTheDocument();
    });

    test('does not display "volume remaining" for minutes goal', () => {
      render(<TimeGoal />);

      expect(screen.queryByText('volume remaining')).not.toBeInTheDocument();
      expect(screen.getByText('time remaining')).toBeInTheDocument();
    });

    test('does not display "volume remaining" for rounds goal', () => {
      render(<RoundsGoal />);

      expect(screen.queryByText('volume remaining')).not.toBeInTheDocument();
      expect(screen.getByText('rounds remaining')).toBeInTheDocument();
    });
  });

  describe('zero goal edge case', () => {
    test('displays no progress information when workoutGoal is 0', () => {
      render(<VolumeGoalZero />);

      expect(screen.queryByText('volume remaining')).not.toBeInTheDocument();

      const progressBar = screen.getByText('∞');
      expect(progressBar).toBeInTheDocument();
    });

    test('does not display percentage when workoutGoal is 0', () => {
      render(<VolumeGoalZero />);

      expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
    });
  });

  describe('remaining volume capped at zero', () => {
    test('displays 0% remaining when completedVolume exceeds workoutGoal', () => {
      render(<VolumeGoalExceeded />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    test('displays 0% remaining when completedVolume significantly exceeds workoutGoal', () => {
      render(<VolumeGoalSignificantlyExceeded />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    test('never displays negative percentage', () => {
      render(<VolumeGoalExceeded />);

      const text = screen.getByText('0%');
      expect(text).toBeInTheDocument();
      expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
    });
  });

  describe('very large volume values', () => {
    test('handles large volume values correctly (10000kg goal)', () => {
      render(<VolumeGoalLargeValues />);

      expect(screen.getByText('88%')).toBeInTheDocument();
    });

    test('calculates percentage correctly with large completed volume', () => {
      render(<VolumeGoalLargeValuesHalfway />);

      expect(screen.getByText('25%')).toBeInTheDocument();
    });

    test('handles very large values without overflow', () => {
      render(<VolumeGoalVeryLargeValues />);

      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });
});
