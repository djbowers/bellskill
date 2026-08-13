import {
  useLinkUserMovement,
  useMovementCatalog,
  useUserMovementFrequency,
} from '~/api';
import { Loading } from '~/components';
import { Card } from '~/components/ui/card';

import { CustomMovementRow } from './CustomMovementRow';

export const CustomMovementsPanel = () => {
  const { data: userMovements = [], isLoading: isLoadingUserMovements } =
    useUserMovementFrequency();
  const { data: catalog = [], isLoading: isLoadingCatalog } =
    useMovementCatalog();
  const linkUserMovement = useLinkUserMovement();

  const customMovements = userMovements.filter(
    (movement) => movement.functionalMovementId == null,
  );

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
              id={movement.id}
              canonicalName={movement.canonicalName}
              logCount={movement.logCount}
              catalog={catalog}
              isLinking={
                linkUserMovement.isPending &&
                linkUserMovement.variables?.userMovementId === movement.id
              }
              onLink={(userMovementId, functionalMovementId) =>
                linkUserMovement.mutate({
                  userMovementId,
                  functionalMovementId,
                })
              }
            />
          ))}
        </div>
      </Card>
    </>
  );
};
