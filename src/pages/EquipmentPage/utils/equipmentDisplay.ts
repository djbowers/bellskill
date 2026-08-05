import type { UserEquipment } from '~/api';
import { getWeightUnitLabel } from '~/utils';

/** The weight shown on the row: "24 kg" for fixed, "12–32 kg" for adjustable. */
export const equipmentWeightLabel = (item: UserEquipment): string => {
  const unit = getWeightUnitLabel(item.unit);
  if (item.kind === 'fixed') return `${item.weight} ${unit}`;
  return `${item.minWeight}–${item.maxWeight} ${unit}`;
};

/** Short badges qualifying the row: how many, and how finely it adjusts. */
export const equipmentBadges = (item: UserEquipment): string[] => {
  const badges: string[] = [];
  if (item.quantity === 2) badges.push('Pair');
  else if (item.quantity > 2) badges.push(`×${item.quantity}`);
  if (item.kind === 'adjustable' && item.stepWeight !== null) {
    badges.push(`${item.stepWeight} ${getWeightUnitLabel(item.unit)} steps`);
  }
  return badges;
};

/** Names the row for screen readers and for the delete confirmation. */
export const equipmentName = (item: UserEquipment): string => {
  const base =
    item.kind === 'fixed'
      ? equipmentWeightLabel(item)
      : `adjustable ${equipmentWeightLabel(item)}`;
  return item.quantity > 1 ? `${base} (×${item.quantity})` : base;
};
