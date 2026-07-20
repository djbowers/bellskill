import { useNavigate } from 'react-router-dom';

import { Page } from '~/components';
import { Button } from '~/components/ui/button';

export const CheckoutCancelPage = () => {
  const navigate = useNavigate();

  return (
    <Page title={null}>
      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <h1 className="text-xl font-semibold">Checkout canceled</h1>
        <p className="text-sm text-muted-foreground">
          No charge was made. You can upgrade whenever you&apos;re ready.
        </p>
        <div className="flex w-full flex-col gap-1">
          <Button onClick={() => navigate('/paywall')} className="w-full">
            Back to plans
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="w-full"
          >
            Not now
          </Button>
        </div>
      </div>
    </Page>
  );
};
