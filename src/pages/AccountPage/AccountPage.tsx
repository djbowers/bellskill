import { ChangeEventHandler, useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import {
  SubscriptionState,
  useConnectSpotify,
  useCreatePortalSession,
  useDisconnectSpotify,
  useSetSubscription,
  useSpotifyConnection,
} from '~/api';
import { Page, TrialStatusPill } from '~/components';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import {
  isOwner,
  isPreviewOverrideEnabled,
  setPreviewOverrideEnabled,
} from '~/config/features';
import { useEntitlement, useSession } from '~/contexts';
import { useFeatures } from '~/hooks';
import { supabase } from '~/supabaseClient';
import { isSoundEnabled, setSoundEnabled } from '~/utils';

export const AccountPage = () => {
  const session = useSession();
  const navigate = useNavigate();
  const {
    isPremium,
    isTrialing,
    refetch: refetchEntitlement,
  } = useEntitlement();
  const { mutate: openPortal, isPending: portalLoading } =
    useCreatePortalSession();
  const { mutate: setSubscription, isPending: settingSubscription } =
    useSetSubscription();

  const [username, setUsername] = useState<string>('');
  const [previewEnabled, setPreviewEnabled] = useState<boolean>(
    isPreviewOverrideEnabled(),
  );
  const [soundEnabled, setSoundEnabledState] =
    useState<boolean>(isSoundEnabled());

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSoundEnabledState(next);
  };

  const handleTogglePreview = () => {
    const next = !previewEnabled;
    setPreviewOverrideEnabled(next);
    setPreviewEnabled(next);
    // Routes are built once from the effective flags, so reload to apply.
    window.location.reload();
  };

  const currentState: SubscriptionState = isPremium
    ? 'premium'
    : isTrialing
      ? 'trialing'
      : 'free';

  const handleSetSubscription = (state: SubscriptionState) => {
    setSubscription(state, {
      onSuccess: () => refetchEntitlement(),
    });
  };

  const features = useFeatures();
  const { data: spotifyConnection } = useSpotifyConnection(features.spotify);
  const { mutate: connectSpotify, isPending: connectingSpotify } =
    useConnectSpotify();
  const { mutate: disconnectSpotify, isPending: disconnectingSpotify } =
    useDisconnectSpotify();

  const spotifyConnected = spotifyConnection?.connected ?? false;
  const spotifyUserId = spotifyConnection?.spotifyUserId;

  const handleConnectSpotify = () => {
    connectSpotify(undefined, {
      onSuccess: (url) => {
        window.location.href = url;
      },
    });
  };

  const handleDisconnectSpotify = () => {
    if (window.confirm('Disconnect Spotify from Bellskill?')) {
      disconnectSpotify();
    }
  };

  const handleManageSubscription = () => {
    openPortal(undefined, {
      onSuccess: (url) => {
        window.location.href = url;
      },
    });
  };

  useEffect(() => {
    async function getProfile() {
      const { user } = session;

      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (error) {
        console.warn(error);
      } else if (data) {
        setUsername(data.username || '');
      }
    }

    getProfile();
  }, [session]);

  const [updateError, updateProfile] = useActionState<string | null>(
    async () => {
      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        username,
        updated_at: new Date().toISOString(),
      });

      return error ? error.message : null;
    },
    null,
  );

  const handleChangeUsername: ChangeEventHandler<HTMLInputElement> = (e) => {
    setUsername(e.target.value);
  };

  return (
    <Page title="Account">
      <TrialStatusPill />

      <form action={updateProfile} className="flex flex-col space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={session.user.email} disabled={true} />

        <Label htmlFor="name">Name</Label>
        <Input id="name" value={username} onChange={handleChangeUsername} />

        {updateError && (
          <p className="text-sm text-destructive">{updateError}</p>
        )}

        <div className="flex justify-end">
          <SubmitButton />
        </div>
      </form>

      <div className="flex flex-col gap-1 border-t pt-2">
        <Label>My Equipment</Label>
        <p className="text-xs text-muted-foreground">
          Tell Bellskill which kettlebells you own so session and program
          recommendations prescribe weights you can actually load.
        </p>
        <Button variant="outline" onClick={() => navigate('/account/equipment')}>
          Manage equipment
        </Button>
      </div>

      <div className="flex flex-col gap-1 border-t pt-2">
        <Label>Sound</Label>
        <p className="text-xs text-muted-foreground">
          Play a sound and vibrate when a rest or interval timer ends, so you
          know it&apos;s time for the next set without looking at your screen.
        </p>
        <Button variant="outline" onClick={handleToggleSound}>
          {soundEnabled ? 'Disable timer sounds' : 'Enable timer sounds'}
        </Button>
      </div>

      {features.spotify && (
        <div className="flex flex-col gap-1 border-t pt-2">
          <Label>Spotify</Label>
          <p className="text-xs text-muted-foreground">
            {spotifyConnected
              ? `Connected${spotifyUserId ? ` as ${spotifyUserId}` : ''}. Music controls appear during your workouts.`
              : 'Connect your Spotify account to see and control your music during workouts.'}
          </p>
          {spotifyConnected ? (
            <Button
              variant="outline"
              onClick={handleDisconnectSpotify}
              loading={disconnectingSpotify}
            >
              Disconnect Spotify
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleConnectSpotify}
              loading={connectingSpotify}
            >
              Connect Spotify
            </Button>
          )}
        </div>
      )}

      {isPremium && (
        <div className="flex flex-col gap-1 border-t pt-2">
          <Label>Subscription</Label>
          <Button
            variant="outline"
            onClick={handleManageSubscription}
            loading={portalLoading}
          >
            Manage Subscription
          </Button>
        </div>
      )}

      {isOwner(session) && (
        <div className="flex flex-col gap-1 border-t pt-2">
          <Label>Developer</Label>
          <p className="text-xs text-muted-foreground">
            Preview every feature in production, even when its flag is disabled.
            Owner-only — has no effect for other accounts.
          </p>
          <Button variant="outline" onClick={handleTogglePreview}>
            {previewEnabled
              ? 'Disable feature preview'
              : 'Enable feature preview'}
          </Button>
        </div>
      )}

      {isOwner(session) && (
        <div className="flex flex-col gap-1 border-t pt-2">
          <Label>Subscription (QA)</Label>
          <p className="text-xs text-muted-foreground">
            Flip your account between states to test premium vs free surfaces.
            Owner-only — has no effect for other accounts.
          </p>
          <div className="flex gap-1">
            {(['free', 'premium', 'trialing'] as SubscriptionState[]).map(
              (state) => (
                <Button
                  key={state}
                  className="flex-1 capitalize"
                  variant={currentState === state ? 'default' : 'outline'}
                  disabled={settingSubscription}
                  onClick={() => handleSetSubscription(state)}
                >
                  {state}
                </Button>
              ),
            )}
          </div>
        </div>
      )}
    </Page>
  );
};

const SubmitButton = () => {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending}>
      Update
    </Button>
  );
};
