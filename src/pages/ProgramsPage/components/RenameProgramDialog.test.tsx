import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { RenameProgramDialog } from './RenameProgramDialog';

const setup = (
  props: Partial<Parameters<typeof RenameProgramDialog>[0]> = {},
) => {
  const onSubmit = vi.fn();
  render(
    <RenameProgramDialog
      open
      onOpenChange={() => {}}
      currentTitle="Dry Fighting Weight"
      onSubmit={onSubmit}
      isPending={false}
      {...props}
    />,
  );
  return { onSubmit };
};

describe('RenameProgramDialog', () => {
  it('seeds the input with the current title', () => {
    setup();
    expect(screen.getByLabelText('Title')).toHaveValue('Dry Fighting Weight');
  });

  it('disables save while the title is unchanged', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('disables save when the title is emptied', async () => {
    setup();
    await userEvent.clear(screen.getByLabelText('Title'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('submits the trimmed title', async () => {
    const { onSubmit } = setup();
    const input = screen.getByLabelText('Title');
    await userEvent.clear(input);
    await userEvent.type(input, '  Rite of Passage  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith('Rite of Passage');
  });
});
