import {
  ChangeEventHandler,
  FormEventHandler,
  useEffect,
  useState,
} from 'react';

import { useCreatePortalSession } from '~/api';
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
import { supabase } from '~/supabaseClient';

export const AccountPage = () => {
  const session = useSession();
  const { isPremium } = useEntitlement();
  const { mutate: openPortal, isLoading: portalLoading } =
    useCreatePortalSession();

  const [loading, setLoading] = useState<boolean>(true);
  const [username, setUsername] = useState<string>('');
  const [previewEnabled, setPreviewEnabled] = useState<boolean>(
    isPreviewOverrideEnabled(),
  );

  const handleTogglePreview = () => {
    const next = !previewEnabled;
    setPreviewOverrideEnabled(next);
    setPreviewEnabled(next);
    // Routes are built once from the effective flags, so reload to apply.
    window.location.reload();
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
      setLoading(true);
      const { user } = session;

      let { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (error) {
        console.warn(error);
      } else if (data) {
        setUsername(data.username || '');
      }

      setLoading(false);
    }

    getProfile();
  }, [session]);

  const updateProfile: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();

    setLoading(true);
    const { user } = session;

    const updates = {
      id: user.id,
      username,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('profiles').upsert(updates);

    if (error) {
      alert(error.message);
    }
    setLoading(false);
  };

  const handleChangeUsername: ChangeEventHandler<HTMLInputElement> = (e) => {
    setUsername(e.target.value);
  };

  return (
    <Page title="Account">
      <TrialStatusPill />

      <form onSubmit={updateProfile} className="flex flex-col space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={session.user.email} disabled={true} />

        <Label htmlFor="name">Name</Label>
        <Input id="name" value={username} onChange={handleChangeUsername} />

        <div className="flex justify-end">
          <Button type="submit" loading={loading}>
            Update
          </Button>
        </div>
      </form>

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
    </Page>
  );
};
