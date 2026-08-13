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
      onChangeRungMode={noop}
      {...overrides}
    />,
  );

describe('LadderRepScheme — rung modes', () => {
  test('reports the picked mode', async () => {
    const onChangeRungMode = vi.fn();
    renderLadder({ onChangeRungMode });

    await userEvent.click(screen.getByRole('tab', { name: 'Max' }));

    expect(onChangeRungMode).toHaveBeenCalledWith('max');
  });

  test('an active interval timer locks out Time and Max', () => {
    renderLadder({ intervalActive: true });

    expect(screen.getByRole('tab', { name: 'Time' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Max' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Reps' })).toBeEnabled();
  });
});

describe('LadderRepScheme — max reps', () => {
  test('rungs become bare set slots with no magnitude to pick', () => {
    renderLadder({ maxReps: true });

    expect(screen.getByRole('button', { name: 'Set 1, max reps' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set 3, max reps' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^\+ reps/ })).not.toBeInTheDocument();
  });

  test('sets can still be added and removed', async () => {
    const onAddRung = vi.fn();
    const onRemoveRung = vi.fn();
    renderLadder({ maxReps: true, onAddRung, onRemoveRung });

    await userEvent.click(screen.getByRole('button', { name: 'Add rung' }));
    expect(onAddRung).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /remove set 3/i }));
    expect(onRemoveRung).toHaveBeenCalledWith(2);
  });
});
