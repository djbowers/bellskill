import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Page } from '~/components';
import { Button } from '~/components/ui/button';
import { useEntitlement } from '~/contexts';

// Poll for the webhook race: Stripe redirects back here a beat before the
// webhook flips the user to premium. Refetch immediately, then every 2s.
const POLL_MS = 2000;
const MAX_ATTEMPTS = 8; // ~16s before showing the calm "it'll update shortly" state

export const CheckoutSuccessPage = () => {
  const navigate = useNavigate();
  const { effectiveAccess, refetch } = useEntitlement();
  const [attempts, setAttempts] = useState(0);

  const active = effectiveAccess === 'premium';
  const exhausted = attempts >= MAX_ATTEMPTS;

  useEffect(() => {
    if (active || exhausted) return;
    const delay = attempts === 0 ? 0 : POLL_MS;
    const timer = setTimeout(() => {
      refetch();
      setAttempts((a) => a + 1);
    }, delay);
    return () => clearTimeout(timer);
    // refetch is intentionally omitted — its identity changes each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempts, active, exhausted]);

  if (active) {
    return (
      <Page title={null}>
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <h1 className="text-xl font-semibold">You&apos;re Premium 🎉</h1>
          <p className="text-sm text-muted-foreground">
            Your subscription is active. The intelligence layer is unlocked.
          </p>
          <Button onClick={() => navigate('/')} className="w-full">
            Continue
          </Button>
        </div>
      </Page>
    );
  }

  return (
    <Page title={null}>
      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <h1 className="text-xl font-semibold">
          {exhausted ? 'Almost there' : 'Activating your subscription…'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {exhausted
            ? "Payment received — your account will update shortly. You can keep using the app; it'll unlock automatically."
            : 'Hang tight while we confirm your payment.'}
        </p>
        {exhausted && (
          <div className="flex w-full flex-col gap-1">
            <Button
              variant="secondary"
              onClick={() => setAttempts(0)}
              className="w-full"
            >
              Check again
            </Button>
            <Button onClick={() => navigate('/')} className="w-full">
              Continue
            </Button>
          </div>
        )}
      </div>
    </Page>
  );
};
