import { useState } from 'react';

import {
  useLinkUserMovement,
  useMovementCatalog,
  useUserMovementFrequency,
} from '~/api';
import { Loading } from '~/components';
import { Card } from '~/components/ui/card';

import { CustomMovementRow } from './CustomMovementRow';
import { LinkMovementDialog } from './LinkMovementDialog';

export const CustomMovementsPanel = () => {
  const { data: userMovements = [], isLoading: isLoadingUserMovements } =
    useUserMovementFrequency();
  const { data: catalog = [], isLoading: isLoadingCatalog } =
    useMovementCatalog();
  const linkUserMovement = useLinkUserMovement();
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const customMovements = userMovements.filter(
    (movement) => movement.functionalMovementId == null,
  );

  const linkingMovement =
    customMovements.find((movement) => movement.id === linkingId) ?? null;

  const handleLink = (functionalMovementId: string) => {
    if (!linkingId) return;
    linkUserMovement.mutate(
      { userMovementId: linkingId, functionalMovementId },
      { onSuccess: () => setLinkingId(null) },
    );
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
    </>
  );
};
