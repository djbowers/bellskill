import { useNavigate, useRouteError } from 'react-router-dom';

import { Page } from '~/components';
import { Button } from '~/components/ui/button';

/**
 * `errorElement` for the root route. Catches errors thrown while rendering a
 * route or from a loader/action and renders a friendly fallback in place of the
 * raw React Router dev error page. Because it replaces the root element, it does
 * not render the `Root` nav shell (Sidebar / BottomNav) — it is intentionally
 * self-contained.
 */
export const RouteErrorBoundary = () => {
  const navigate = useNavigate();
  const error = useRouteError();

  // Surface the underlying error to the console for debugging without exposing
  // it to the user.
  console.error('Route error:', error);

  return (
    <Page title={null}>
      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. Try heading back home and giving it
          another go.
        </p>
        <Button onClick={() => navigate('/')} className="w-full">
          Back to home
        </Button>
      </div>
    </Page>
  );
};
