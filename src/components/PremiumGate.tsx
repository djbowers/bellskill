import { LockClosedIcon } from '@radix-ui/react-icons';
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import { useEntitlement } from '~/contexts';

import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface PremiumGateProps {
  children: ReactNode;
  /** Name of the gated surface, shown in the locked state. */
  featureName?: string;
}

/**
 * Wraps a premium surface. When the user has premium access (paid or trialing)
 * the children render; otherwise a clean lock treatment routes to the paywall.
 * This is UX only — the authoritative gate is server-side (has_premium_access +
 * RLS). Never assume client state is authoritative.
 */
export const PremiumGate = ({
  children,
  featureName = 'This feature',
}: PremiumGateProps) => {
  const { effectiveAccess, isLoading } = useEntitlement();
  const navigate = useNavigate();

  if (isLoading) return null;

  if (effectiveAccess === 'premium') return <>{children}</>;

  return (
    <Card className="mx-auto my-2 w-full max-w-md">
      <CardContent className="flex flex-col items-center gap-2 p-3 text-center">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
          <LockClosedIcon className="h-2.5 w-2.5" />
        </div>
        <div className="text-lg font-semibold">Premium feature</div>
        <p className="text-sm text-muted-foreground">
          {featureName} is part of BellSkill Premium — the intelligence layer on
          top of your training.
        </p>
        <Button onClick={() => navigate('/paywall')}>See what's included</Button>
      </CardContent>
    </Card>
  );
};
