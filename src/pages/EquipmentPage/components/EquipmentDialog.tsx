import { useState } from 'react';

import type { UserEquipment } from '~/api';
import { ModifyCountButtons, WeightUnitTabs } from '~/components';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { WeightUnit } from '~/types';
import { EquipmentRow, getWeightRange, getWeightUnitLabel } from '~/utils';

interface EquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The bell being edited, or null when adding a new one. */
  item: UserEquipment | null;
  onSave: (input: EquipmentRow) => void;
  saving?: boolean;
}

interface DraftState {
  kind: 'fixed' | 'adjustable';
  unit: WeightUnit;
  weight: number;
  minWeight: number;
  maxWeight: number;
  stepWeight: number;
  quantity: number;
}

const emptyDraft = (): DraftState => ({
  kind: 'fixed',
  unit: 'kilograms',
  weight: 16,
  minWeight: 12,
  maxWeight: 32,
  stepWeight: 2,
  quantity: 1,
});

const draftFromItem = (item: UserEquipment | null): DraftState => {
  if (!item) return emptyDraft();
  const base = emptyDraft();
  return {
    kind: item.kind,
    unit: item.unit,
    weight: item.weight ?? base.weight,
    minWeight: item.minWeight ?? base.minWeight,
    maxWeight: item.maxWeight ?? base.maxWeight,
    stepWeight: item.stepWeight ?? base.stepWeight,
    quantity: item.quantity,
  };
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const EquipmentDialog = ({
  open,
  onOpenChange,
  item,
  onSave,
  saving = false,
}: EquipmentDialogProps) => {
  const [draft, setDraft] = useState<DraftState>(() => draftFromItem(item));
  const [wasOpen, setWasOpen] = useState(open);

  // Re-seed on every open so a new bell never inherits the last one's values.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(draftFromItem(item));
  }

  const range = getWeightRange(draft.unit);
  const unitLabel = getWeightUnitLabel(draft.unit);

  const set = <K extends keyof DraftState>(key: K, value: DraftState[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const setWeight = (key: keyof DraftState, value: number) =>
    set(key, clamp(value, range.min, range.max) as DraftState[keyof DraftState]);

  const rangeInvalid =
    draft.kind === 'adjustable' && draft.maxWeight < draft.minWeight;

  const handleSave = () => {
    if (rangeInvalid) return;
    onSave({
      kind: draft.kind,
      unit: draft.unit,
      quantity: draft.quantity,
      weight: draft.kind === 'fixed' ? draft.weight : null,
      minWeight: draft.kind === 'adjustable' ? draft.minWeight : null,
      maxWeight: draft.kind === 'adjustable' ? draft.maxWeight : null,
      stepWeight: draft.kind === 'adjustable' ? draft.stepWeight : null,
    });
  };

  const weightPicker = (
    key: 'weight' | 'minWeight' | 'maxWeight',
    label: string,
  ) => (
    <ModifyCountButtons
      bellUnit={draft.unit}
      label={label}
      min={range.min}
      max={range.max}
      unit={unitLabel}
      value={draft[key]}
      onChange={(value) => setWeight(key, value)}
      onClickMinus={() => setWeight(key, draft[key] - 1)}
      onClickPlus={() => setWeight(key, draft[key] + 1)}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit bell' : 'Add equipment'}</DialogTitle>
          <DialogDescription>
            Recommendations use this to prescribe weights you can actually load.
          </DialogDescription>
        </DialogHeader>

        {/* min-w-0: the weight strip's intrinsic width must not stretch the
            dialog's grid track. */}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center justify-between gap-1">
            <Tabs
              value={draft.kind}
              onValueChange={(value) =>
                set('kind', value as DraftState['kind'])
              }
            >
              <TabsList>
                <TabsTrigger size="sm" value="fixed">
                  Fixed
                </TabsTrigger>
                <TabsTrigger size="sm" value="adjustable">
                  Adjustable
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <WeightUnitTabs
              value={draft.unit}
              onChange={(unit) => set('unit', unit)}
            />
          </div>

          {draft.kind === 'fixed' ? (
            <div className="flex flex-col gap-1">
              <Label>Weight</Label>
              {weightPicker('weight', 'Weight')}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-col gap-1">
                <Label>Lightest setting</Label>
                {weightPicker('minWeight', 'Lightest setting')}
              </div>
              <div className="flex flex-col gap-1">
                <Label>Heaviest setting</Label>
                {weightPicker('maxWeight', 'Heaviest setting')}
              </div>
              <div className="flex flex-col gap-1">
                <Label>Adjusts in steps of</Label>
                <ModifyCountButtons
                  label="Adjusts in steps of"
                  min={0.5}
                  max={10}
                  step={0.5}
                  unit={unitLabel}
                  value={draft.stepWeight}
                  onChange={(value) => set('stepWeight', clamp(value, 0.5, 10))}
                  onClickMinus={() =>
                    set('stepWeight', clamp(draft.stepWeight - 0.5, 0.5, 10))
                  }
                  onClickPlus={() =>
                    set('stepWeight', clamp(draft.stepWeight + 0.5, 0.5, 10))
                  }
                />
              </div>
              {rangeInvalid && (
                <p className="text-xs text-destructive">
                  The heaviest setting must be at least the lightest setting.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label>How many</Label>
            <ModifyCountButtons
              label="How many"
              min={1}
              max={10}
              unit={draft.quantity === 1 ? 'bell' : 'bells'}
              value={draft.quantity}
              onChange={(value) => set('quantity', clamp(value, 1, 10))}
              onClickMinus={() =>
                set('quantity', clamp(draft.quantity - 1, 1, 10))
              }
              onClickPlus={() =>
                set('quantity', clamp(draft.quantity + 1, 1, 10))
              }
            />
            <p className="text-xs text-muted-foreground">
              {draft.quantity > 1
                ? 'Two or more unlocks double-bell work at this weight.'
                : 'Add a second bell to unlock double-bell work at this weight.'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={rangeInvalid}
          >
            {item ? 'Save bell' : 'Add bell'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
