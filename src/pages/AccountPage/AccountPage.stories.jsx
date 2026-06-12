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
      <SessionProvider value={{ user: { email: 'luke@skywalker.com' } }}>
        <EntitlementContext.Provider value={freeEntitlement}>
          <Story />
        </EntitlementContext.Provider>
      </SessionProvider>
    ),
  ],
};

export const Default = {};
