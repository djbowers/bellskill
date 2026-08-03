import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useSpotifyCallback } from '~/api';
import { Page } from '~/components';
import { Button } from '~/components/ui/button';

export const SpotifyCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { mutate: completeCallback, isPending, isError } = useSpotifyCallback();

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const denied = searchParams.get('error') !== null || !code || !state;

  useEffect(() => {
    if (denied) return;
    completeCallback(
      { code, state },
      { onSuccess: () => navigate('/account') },
    );
  }, [denied, code, state, completeCallback, navigate]);

  if (denied || isError) {
    return (
      <Page title={null}>
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <h1 className="text-xl font-semibold">Spotify not connected</h1>
          <p className="text-sm text-muted-foreground">
            {denied
              ? 'The connection was cancelled. You can try again from your account page.'
              : "Something went wrong finishing the connection. It's safe to try again."}
          </p>
          <Button onClick={() => navigate('/account')} className="w-full">
            Back to Account
          </Button>
        </div>
      </Page>
    );
  }

  return (
    <Page title={null}>
      <div className="flex flex-col items-center gap-2 py-3 text-center">
        <h1 className="text-xl font-semibold">
          {isPending ? 'Connecting Spotify…' : 'Almost there…'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Linking your Spotify account so you can control music during workouts.
        </p>
      </div>
    </Page>
  );
};
