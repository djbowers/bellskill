import { createContext, useContext } from 'react';

import { Entitlement, useEntitlementQuery } from '~/api/useEntitlement';

export interface EntitlementContextValue extends Entitlement {
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Conservative default used before the subscription row loads: treat the user as
 * free so premium surfaces never flash unlocked. Client gating is UX only — the
 * authoritative gate is server-side (has_premium_access + RLS).
 */
const DEFAULT_ENTITLEMENT: Entitlement = {
  isPremium: false,
  isTrialing: false,
  trialExpired: false,
  trialDaysRemaining: null,
  effectiveAccess: 'free',
};

// eslint-disable-next-line react-refresh/only-export-components -- context object is intentionally co-located with its Provider; splitting the module is out of scope for the lint pass
export const EntitlementContext = createContext<EntitlementContextValue>(
  undefined!,
);

export const EntitlementProvider = ({ ...props }) => {
  const { data, isLoading, refetch } = useEntitlementQuery();

  const value: EntitlementContextValue = {
    ...(data ?? DEFAULT_ENTITLEMENT),
    isLoading,
    refetch: () => {
      refetch();
    },
  };

  return <EntitlementContext value={value} {...props} />;
};

// eslint-disable-next-line react-refresh/only-export-components -- consumer hook is intentionally co-located with its Provider; splitting the module is out of scope for the lint pass
export const useEntitlement = () => useContext(EntitlementContext);
