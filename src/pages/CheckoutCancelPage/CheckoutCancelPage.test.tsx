import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { CheckoutCancelPage } from './CheckoutCancelPage';

describe('CheckoutCancelPage', () => {
  test('reads as canceled with no guilt and offers a way back', () => {
    render(
      <MemoryRouter>
        <CheckoutCancelPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Checkout canceled')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Back to plans' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
  });
});
