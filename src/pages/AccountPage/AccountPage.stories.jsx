import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';

import { EntitlementContext, SessionProvider } from '~/contexts';

import { AccountPage } from './AccountPage';

const freeEntitlement = {
  isPremium: false,
  isTrialing: false,
  trialExpired: false,
  trialDaysRemaining: null,
  effectiveAccess: 'free',
  isLoading: false,
  refetch: () => {},
};

export default {
  component: AccountPage,
  decorators: [
    (Story) => (
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SessionProvider value={{ user: { email: 'luke@skywalker.com' } }}>
            <EntitlementContext.Provider value={freeEntitlement}>
              <Story />
            </EntitlementContext.Provider>
          </SessionProvider>
        </MemoryRouter>
      </QueryClientProvider>
    ),
  ],
};

export const Default = {};
