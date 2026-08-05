import { useMemo, useState } from 'react';

import {
  UserEquipment,
  useAddUserEquipment,
  useDeleteUserEquipment,
  useUpdateUserEquipment,
  useUserEquipment,
} from '~/api';
import { Page } from '~/components';
import { Button } from '~/components/ui/button';
import { EquipmentRow, summarizeEquipment } from '~/utils';

import { EquipmentDialog } from './components/EquipmentDialog';
import { EquipmentListRow } from './components/EquipmentListRow';
import { LoadableWeightsCard } from './components/LoadableWeightsCard';
import { equipmentName } from './utils/equipmentDisplay';

export const EquipmentPage = () => {
  const { data: items = [], isLoading } = useUserEquipment();
  const add = useAddUserEquipment();
  const update = useUpdateUserEquipment();
  const remove = useDeleteUserEquipment();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserEquipment | null>(null);

  const summary = useMemo(() => summarizeEquipment(items), [items]);

  const fixed = items.filter((item) => item.kind === 'fixed');
  const adjustable = items.filter((item) => item.kind === 'adjustable');

  const handleAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (item: UserEquipment) => {
    setEditing(item);
    setDialogOpen(true);
  };

  const handleDelete = (item: UserEquipment) => {
    if (window.confirm(`Remove ${equipmentName(item)} from your equipment?`)) {
      remove.mutate(item.id);
    }
  };

  const handleSave = (input: EquipmentRow) => {
    const onSuccess = () => setDialogOpen(false);
    if (editing) update.mutate({ id: editing.id, input }, { onSuccess });
    else add.mutate(input, { onSuccess });
  };

  return (
    <Page title="My Equipment">
      <p className="text-xs text-muted-foreground">
        Tell Bellskill which kettlebells you own. Session and program
        recommendations then prescribe weights you can actually load.
      </p>

      {summary && <LoadableWeightsCard items={items} summary={summary} />}

      {!isLoading && items.length === 0 && (
        <p className="py-2 text-center text-sm text-muted-foreground">
          No equipment yet. Add your first bell and recommendations will start
          matching your rack.
        </p>
      )}

      {fixed.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fixed bells
          </h2>
          {fixed.map((item) => (
            <EquipmentListRow
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </section>
      )}

      {adjustable.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Adjustable bells
          </h2>
          {adjustable.map((item) => (
            <EquipmentListRow
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </section>
      )}

      <Button onClick={handleAdd}>Add equipment</Button>

      <EquipmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
        onSave={handleSave}
        saving={add.isPending || update.isPending}
      />
    </Page>
  );
};
