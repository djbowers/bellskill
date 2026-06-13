import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';

import {
  EntitlementContext,
  EntitlementContextValue,
} from '~/contexts';

import { PaywallPage } from './PaywallPage';

const withEntitlement = (value: EntitlementContextValue) => (Story: any) =>
  (
    <EntitlementContext.Provider value={value}>
      <Story />
    </EntitlementContext.Provider>
  );

const base: EntitlementContextValue = {
  isPremium: false,
  isTrialing: false,
  trialExpired: false,
  trialDaysRemaining: null,
  effectiveAccess: 'free',
  isLoading: false,
  refetch: () => {},
};

export default {
  component: PaywallPage,
  decorators: [
    (Story: any) => (
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Story />
        </MemoryRouter>
      </QueryClientProvider>
    ),
  ],
};

export const Trialing = {
  decorators: [
    withEntitlement({
      ...base,
      isTrialing: true,
      trialDaysRemaining: 12,
      effectiveAccess: 'premium',
    }),
  ],
};

export const Expired = {
  decorators: [withEntitlement({ ...base, trialExpired: true })],
};

export const Free = {
  decorators: [withEntitlement(base)],
};
