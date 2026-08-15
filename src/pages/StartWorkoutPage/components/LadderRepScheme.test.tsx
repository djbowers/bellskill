import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { LadderRepScheme } from './LadderRepScheme';

const noop = () => {};

const renderLadder = (overrides = {}) =>
  render(
    <LadderRepScheme
      repScheme={[5, 5, 5]}
      onChangeRung={noop}
      onRemoveRung={noop}
      onAddRung={noop}
      onToggleTimed={noop}
      {...overrides}
    />,
  );

describe('LadderRepScheme — max rungs', () => {
  test('a 0 rung reads as ∞, alongside its prescribed neighbours', () => {
    renderLadder({ repScheme: [1, 2, 3, 0] });

    expect(
      screen.getByRole('button', { name: 'Rung 1, 1 reps' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Rung 4, max reps' }),
    ).toHaveTextContent('∞');
  });

  test('a timed 0 rung reads as ∞, not 0:00', () => {
    renderLadder({ repScheme: [15, 30, 0], timedRungs: true });

    expect(
      screen.getByRole('button', { name: 'Rung 3, max time' }),
    ).toHaveTextContent('∞');
    expect(
      screen.getByRole('button', { name: 'Rung 2, 0:30' }),
    ).toBeInTheDocument();
  });

  test('the caliper winds down to ∞ rather than bottoming out at 1', async () => {
    const onChangeRung = vi.fn();
    renderLadder({ repScheme: [1], onChangeRung });

    await userEvent.click(screen.getByRole('button', { name: '- reps' }));

    expect(onChangeRung).toHaveBeenCalledWith(0, 0);
  });

  test('explains what a focused max rung means', () => {
    renderLadder({ repScheme: [0] });

    expect(screen.getByText(/go to failure/i)).toBeInTheDocument();
  });

  // ∞ alone does not read aloud, so the label carries the words.
  test('the symbol is labelled for screen readers', () => {
    renderLadder({ repScheme: [15, 0], timedRungs: true });

    expect(
      screen.getByRole('button', { name: 'Rung 2, max time' }),
    ).toBeInTheDocument();
  });
});

describe('LadderRepScheme — ceilings', () => {
  test('a timed rung stops at the five-minute ceiling the validator allows', async () => {
    const onChangeRung = vi.fn();
    renderLadder({ repScheme: [300], timedRungs: true, onChangeRung });

    await userEvent.click(screen.getByRole('button', { name: '+ sec' }));

    expect(onChangeRung).toHaveBeenCalledWith(0, 300);
  });

  test('a rep rung stops at the top of its own, smaller range', async () => {
    const onChangeRung = vi.fn();
    renderLadder({ repScheme: [50], onChangeRung });

    await userEvent.click(screen.getByRole('button', { name: '+ reps' }));

    expect(onChangeRung).toHaveBeenCalledWith(0, 50);
  });
});

describe('LadderRepScheme — rung units', () => {
  test('an active interval timer locks out Time', () => {
    renderLadder({ intervalActive: true });

    expect(screen.getByRole('tab', { name: 'Time' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Reps' })).toBeEnabled();
  });
});
