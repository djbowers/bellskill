import { NavLink } from 'react-router-dom';

import { useEntitlement } from '~/contexts';

import { Badge } from './ui/badge';

/**
 * Subtle trial countdown. Practitioner-grade restraint: nothing until 7 days
 * remain, a quiet pill from there, and a slightly more visible (destructive)
 * treatment in the final 48 hours. Never a blocking banner.
 */
export const TrialStatusPill = () => {
  const { isTrialing, trialDaysRemaining } = useEntitlement();

  if (!isTrialing || trialDaysRemaining === null || trialDaysRemaining > 7) {
    return null;
  }

  const finalStretch = trialDaysRemaining <= 2;
  const label =
    trialDaysRemaining === 1
      ? '1 day left in trial'
      : `${trialDaysRemaining} days left in trial`;

  return (
    <NavLink to="/paywall">
      <Badge variant={finalStretch ? 'destructive' : 'secondary'}>
        {label}
      </Badge>
    </NavLink>
  );
};
