import { useNavigate } from 'react-router-dom';

import { Page } from '~/components';
import { Button } from '~/components/ui/button';

export const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <Page title={null}>
      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          We couldn't find that page. It may have moved, or the link may be out
          of date.
        </p>
        <Button onClick={() => navigate('/')} className="w-full">
          Back to home
        </Button>
      </div>
    </Page>
  );
};
