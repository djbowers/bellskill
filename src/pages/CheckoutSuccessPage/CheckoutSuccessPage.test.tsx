import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import {
  EntitlementContext,
  EntitlementContextValue,
} from '~/contexts';

import { CheckoutSuccessPage } from './CheckoutSuccessPage';

const base: EntitlementContextValue = {
  isPremium: false,
  isTrialing: false,
  trialExpired: false,
  trialDaysRemaining: null,
  effectiveAccess: 'free',
  isLoading: false,
  refetch: () => {},
};

const renderPage = (value: EntitlementContextValue) =>
  render(
    <MemoryRouter>
      <EntitlementContext.Provider value={value}>
        <CheckoutSuccessPage />
      </EntitlementContext.Provider>
    </MemoryRouter>,
  );

describe('CheckoutSuccessPage', () => {
  test('shows success once entitlement is premium', () => {
    renderPage({ ...base, isPremium: true, effectiveAccess: 'premium' });
    expect(screen.getByText("You're Premium 🎉")).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continue' }),
    ).toBeInTheDocument();
  });

  test('shows pending state and polls (refetch) while still free', async () => {
    const refetch = vi.fn();
    renderPage({ ...base, refetch });
    expect(
      screen.getByText('Activating your subscription…'),
    ).toBeInTheDocument();
    await waitFor(() => expect(refetch).toHaveBeenCalled());
  });
});
