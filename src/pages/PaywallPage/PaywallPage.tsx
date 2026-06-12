import { CheckIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Page } from '~/components';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { useEntitlement } from '~/contexts';

const NOTIFY_INTENT_KEY = 'premium_notify_intent';

const PREMIUM_FEATURES = [
  'AI session recommendations tuned to your training',
  'Tetris programming — auto-fitted workouts',
];

const FREE_FOREVER = [
  'Workout logging',
  'Skill tree',
  'Basic analytics',
];

interface PaywallHeadline {
  eyebrow: string | null;
  title: string;
  subtitle: string;
}

const getHeadline = (
  isTrialing: boolean,
  trialExpired: boolean,
  trialDaysRemaining: number | null,
): PaywallHeadline => {
  if (isTrialing) {
    const days = trialDaysRemaining ?? 0;
    return {
      eyebrow: `${days} ${days === 1 ? 'day' : 'days'} left in your trial`,
      title: 'Keep the intelligence layer',
      subtitle:
        "You're on full Premium right now. Here's what stays unlocked when your trial ends.",
    };
  }

  if (trialExpired) {
    return {
      eyebrow: 'Your trial has ended',
      title: 'Unlock BellSkill Premium',
      subtitle:
        'Your logging, skill tree, and analytics are still here. Premium brings back the intelligence layer.',
    };
  }

  return {
    eyebrow: null,
    title: 'Unlock BellSkill Premium',
    subtitle: 'The intelligence layer on top of your training.',
  };
};

export const PaywallPage = () => {
  const navigate = useNavigate();
  const { isTrialing, trialExpired, trialDaysRemaining } = useEntitlement();
  const [notified, setNotified] = useState<boolean>(
    () => localStorage.getItem(NOTIFY_INTENT_KEY) === 'true',
  );

  const headline = getHeadline(isTrialing, trialExpired, trialDaysRemaining);

  const handleNotify = () => {
    localStorage.setItem(NOTIFY_INTENT_KEY, 'true');
    setNotified(true);
    // Phase 2: replace with create-checkout-session + open Stripe Checkout.
  };

  return (
    <Page title={null}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5 text-center">
          {headline.eyebrow && (
            <Badge variant="secondary" className="mx-auto">
              {headline.eyebrow}
            </Badge>
          )}
          <h1 className="text-xl font-semibold">{headline.title}</h1>
          <p className="text-sm text-muted-foreground">{headline.subtitle}</p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-1.5 p-2">
            <div className="text-sm font-semibold">Premium unlocks</div>
            {PREMIUM_FEATURES.map((feature) => (
              <div key={feature} className="flex items-start gap-1 text-sm">
                <CheckIcon className="mt-0.5 h-2 w-2 shrink-0 text-primary" />
                <span>{feature}</span>
              </div>
            ))}
            <div className="pt-0.5 text-xs text-muted-foreground">
              Free forever: {FREE_FOREVER.join(', ')}.
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-1">
          <Card className="flex-1">
            <CardContent className="flex flex-col items-center gap-0.5 p-2 text-center">
              <div className="text-sm text-muted-foreground">Monthly</div>
              <div className="text-lg font-semibold">$9.99</div>
              <div className="text-xs text-muted-foreground">per month</div>
            </CardContent>
          </Card>
          <Card className="flex-1 border-primary">
            <CardContent className="flex flex-col items-center gap-0.5 p-2 text-center">
              <Badge className="mb-0.5">Best value</Badge>
              <div className="text-sm text-muted-foreground">Yearly</div>
              <div className="text-lg font-semibold">$79</div>
              <div className="text-xs text-muted-foreground">
                per year — under $6.59/mo
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Cancel anytime. No card required during your trial.
        </p>

        {/* Phase 1: payments are not live yet, so the CTA records interest. */}
        {notified ? (
          <Button variant="secondary" disabled className="w-full">
            We'll let you know — thanks!
          </Button>
        ) : (
          <Button onClick={handleNotify} className="w-full">
            Notify me when Premium launches
          </Button>
        )}

        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="w-full"
        >
          Not now
        </Button>
      </div>
    </Page>
  );
};
