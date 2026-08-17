import { useRef, useState } from 'react';

import {
  UserMovementWithFrequency,
  useDeleteUserMovement,
  useLinkUserMovement,
  useMovementCatalog,
  useUserMovementFrequency,
} from '~/api';
import { ConfirmDialog, Loading } from '~/components';
import { Card } from '~/components/ui/card';
import { useToast } from '~/contexts';

import { CustomMovementLogsDialog } from './CustomMovementLogsDialog';
import { CustomMovementRow } from './CustomMovementRow';
import { LinkMovementDialog } from './LinkMovementDialog';

export const CustomMovementsPanel = () => {
  const { data: userMovements = [], isLoading: isLoadingUserMovements } =
    useUserMovementFrequency();
  const { data: catalog = [], isLoading: isLoadingCatalog } =
    useMovementCatalog();
  const linkUserMovement = useLinkUserMovement();
  const deleteUserMovement = useDeleteUserMovement();
  const { showToast } = useToast();
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<UserMovementWithFrequency | null>(
    null,
  );
  // The confirm keeps rendering while it animates out, by which point the
  // deleted row is gone — hold the last target so the name doesn't blank.
  const lastDeleting = useRef<UserMovementWithFrequency | null>(null);
  if (deleting) lastDeleting.current = deleting;

  const customMovements = userMovements.filter(
    (movement) => movement.functionalMovementId == null,
  );

  const findMovement = (id: string | null) =>
    customMovements.find((movement) => movement.id === id) ?? null;

  const linkingMovement = findMovement(linkingId);
  const viewingMovement = findMovement(viewingId);

  const handleLink = (functionalMovementId: string) => {
    if (!linkingId) return;
    linkUserMovement.mutate(
      { userMovementId: linkingId, functionalMovementId },
      { onSuccess: () => setLinkingId(null) },
    );
  };

  const handleDelete = () => {
    if (!deleting) return;
    const { id, canonicalName } = deleting;
    deleteUserMovement.mutate(id, {
      onSuccess: () => {
        showToast(`Deleted “${canonicalName}”`);
        setDeleting(null);
      },
      onError: () => {
        showToast(`Couldn’t delete “${canonicalName}” — try again`, {
          variant: 'destructive',
        });
        setDeleting(null);
      },
    });
  };

  if (isLoadingUserMovements || isLoadingCatalog) {
    return (
      <div className="flex justify-center py-3">
        <Loading />
      </div>
    );
  }

  if (customMovements.length === 0) {
    return (
      <div className="py-3 text-center text-muted-foreground">
        No custom movements — everything you&rsquo;ve logged is linked to the
        catalog.
      </div>
    );
  }

  return (
    <>
      <p className="mb-2 text-sm text-muted-foreground">
        These movements aren&rsquo;t linked to the catalog, so they sit out of
        weight-mode filtering, pattern debt, and recommendations. Linking one
        keeps its history and fills in the missing metadata.
      </p>

      <Card>
        <div className="divide-y">
          {customMovements.map((movement) => (
            <CustomMovementRow
              key={movement.id}
              canonicalName={movement.canonicalName}
              logCount={movement.logCount}
              onClickLink={() => setLinkingId(movement.id)}
              onViewLogs={() => setViewingId(movement.id)}
              onDelete={() => setDeleting(movement)}
            />
          ))}
        </div>
      </Card>

      <LinkMovementDialog
        open={linkingMovement !== null}
        onOpenChange={(open) => !open && setLinkingId(null)}
        canonicalName={linkingMovement?.canonicalName ?? ''}
        logCount={linkingMovement?.logCount ?? 0}
        catalog={catalog}
        isPending={linkUserMovement.isPending}
        onLink={handleLink}
      />

      <CustomMovementLogsDialog
        open={viewingMovement !== null}
        onOpenChange={(open) => !open && setViewingId(null)}
        userMovementId={viewingMovement?.id ?? null}
        canonicalName={viewingMovement?.canonicalName ?? ''}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete movement?"
        description={`“${lastDeleting.current?.canonicalName ?? ''}” has no logs attached, so nothing in your history changes. This can’t be undone.`}
        confirmLabel="Delete movement"
        confirmVariant="destructive"
        dismissLabel="Keep it"
        onConfirm={handleDelete}
        onDismiss={() => setDeleting(null)}
        isPending={deleteUserMovement.isPending}
      />
    </>
  );
};
