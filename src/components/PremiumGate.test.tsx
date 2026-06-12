import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import {
  EntitlementContext,
  EntitlementContextValue,
} from '~/contexts';

import { PremiumGate } from './PremiumGate';

const base: EntitlementContextValue = {
  isPremium: false,
  isTrialing: false,
  trialExpired: false,
  trialDaysRemaining: null,
  effectiveAccess: 'free',
  isLoading: false,
  refetch: () => {},
};

const renderGate = (value: EntitlementContextValue) =>
  render(
    <MemoryRouter>
      <EntitlementContext.Provider value={value}>
        <PremiumGate featureName="AI Recommendations">
          <div>secret premium content</div>
        </PremiumGate>
      </EntitlementContext.Provider>
    </MemoryRouter>,
  );

describe('PremiumGate', () => {
  test('renders children when access is premium', () => {
    renderGate({ ...base, effectiveAccess: 'premium' });
    expect(screen.getByText('secret premium content')).toBeInTheDocument();
  });

  test('renders locked state when access is free', () => {
    renderGate(base);
    expect(screen.queryByText('secret premium content')).not.toBeInTheDocument();
    expect(screen.getByText('Premium feature')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: "See what's included" }),
    ).toBeInTheDocument();
  });

  test('renders nothing while loading', () => {
    const { container } = renderGate({ ...base, isLoading: true });
    expect(container).toBeEmptyDOMElement();
  });
});
