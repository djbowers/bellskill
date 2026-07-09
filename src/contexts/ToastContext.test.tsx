import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ToastProvider, useToast } from './ToastContext';

const Trigger = () => {
  const { showToast } = useToast();
  return (
    <button
      onClick={() =>
        showToast('Something went wrong.', { variant: 'destructive' })
      }
    >
      fire
    </button>
  );
};

describe('ToastProvider', () => {
  it('renders the toast message when fired', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    expect(screen.queryByText('Something went wrong.')).not.toBeInTheDocument();

    await user.click(screen.getByText('fire'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Something went wrong.',
    );
  });

  it('dismisses a toast via its dismiss button', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByText('fire'));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
