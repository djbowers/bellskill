import { CheckIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CheckoutPlan, useCreateCheckoutSession } from '~/api';
import { Page } from '~/components';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { useEntitlement } from '~/contexts';
import { useFeatures } from '~/hooks';
import { cn } from '~/lib/utils';

const NOTIFY_INTENT_KEY = 'premium_notify_intent';

const PREMIUM_FEATURES = [
  'AI session recommendations tuned to your training',
  'Tetris programming — auto-fitted workouts',
];

const FREE_FOREVER = ['Workout logging', 'Skill tree', 'Basic analytics'];

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

interface PlanCardProps {
  selected: boolean;
  onSelect: () => void;
  label: string;
  price: string;
  caption: string;
  badge?: string;
}

const PlanCard = ({
  selected,
  onSelect,
  label,
  price,
  caption,
  badge,
}: PlanCardProps) => (
  <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    className="flex-1"
  >
    <Card
      className={cn('h-full', selected && 'border-primary ring-1 ring-primary')}
    >
      <CardContent className="flex flex-col items-center gap-0.5 p-2 text-center">
        {badge && <Badge className="mb-0.5">{badge}</Badge>}
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold">{price}</div>
        <div className="text-xs text-muted-foreground">{caption}</div>
      </CardContent>
    </Card>
  </button>
);

export const PaywallPage = () => {
  const features = useFeatures();
  const navigate = useNavigate();
  const { isTrialing, trialExpired, trialDaysRemaining } = useEntitlement();

  const [plan, setPlan] = useState<CheckoutPlan>('yearly');
  const {
    mutate: startCheckout,
    isLoading: checkoutLoading,
    isError: checkoutError,
  } = useCreateCheckoutSession();

  const [notified, setNotified] = useState<boolean>(
    () => localStorage.getItem(NOTIFY_INTENT_KEY) === 'true',
  );

  const headline = getHeadline(isTrialing, trialExpired, trialDaysRemaining);

  const handleSubscribe = () => {
    startCheckout(plan, {
      onSuccess: (url) => {
        window.location.href = url;
      },
    });
  };

  const handleNotify = () => {
    localStorage.setItem(NOTIFY_INTENT_KEY, 'true');
    setNotified(true);
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
          <PlanCard
            selected={plan === 'monthly'}
            onSelect={() => setPlan('monthly')}
            label="Monthly"
            price="$9.99"
            caption="per month"
          />
          <PlanCard
            selected={plan === 'yearly'}
            onSelect={() => setPlan('yearly')}
            label="Yearly"
            price="$79"
            caption="per year — under $6.59/mo"
            badge="Best value"
          />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Cancel anytime. No card required during your trial.
        </p>

        {features.premium ? (
          <>
            <Button
              onClick={handleSubscribe}
              loading={checkoutLoading}
              className="w-full"
            >
              Subscribe — {plan === 'yearly' ? '$79/yr' : '$9.99/mo'}
            </Button>
            {checkoutError && (
              <p className="text-center text-xs text-destructive">
                Something went wrong starting checkout. Please try again.
              </p>
            )}
          </>
        ) : /* Premium not launched yet — record interest instead of charging. */
        notified ? (
          <Button variant="secondary" disabled className="w-full">
            We'll let you know — thanks!
          </Button>
        ) : (
          <Button onClick={handleNotify} className="w-full">
            Notify me when Premium launches
          </Button>
        )}

        <Button variant="ghost" onClick={() => navigate(-1)} className="w-full">
          Not now
        </Button>
      </div>
    </Page>
  );
};
