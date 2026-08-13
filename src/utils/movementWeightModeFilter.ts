import { MovementOptions, WeightTabValue } from '~/types';

export interface MovementWeightModeFields {
  primaryEquipment: string | null;
  primaryItemCount: number | null;
  singleOrDoubleArm: string | null;
}

export const WEIGHT_MODE_LABELS: Record<WeightTabValue, string> = {
  none: 'Bodyweight',
  '2h': 'Two-Hand',
  '1h': 'Single',
  double: 'Double',
};

/** Compact variants for the weight-mode tabs, which are four-across on phone widths. */
export const WEIGHT_MODE_SHORT_LABELS: Record<WeightTabValue, string> = {
  none: 'Body',
  '2h': '2-Hand',
  '1h': '1-Hand',
  double: 'Double',
};

export const getWeightTabValue = (movement: {
  weightOneValue: MovementOptions['weightOneValue'];
  weightTwoValue: MovementOptions['weightTwoValue'];
}): WeightTabValue => {
  if (movement.weightOneValue === null) return 'none';
  if (movement.weightTwoValue === null) return '2h';
  if (movement.weightTwoValue === 0) return '1h';
  return 'double';
};

export const movementMatchesWeightMode = (
  row: MovementWeightModeFields,
  mode: WeightTabValue,
): boolean => {
  switch (mode) {
    case 'none':
      return row.primaryEquipment === 'Bodyweight';
    case '2h':
      return (
        row.primaryEquipment === 'Kettlebell' &&
        row.primaryItemCount === 1 &&
        row.singleOrDoubleArm === 'Double Arm'
      );
    case '1h':
      return (
        row.primaryEquipment === 'Kettlebell' &&
        row.primaryItemCount === 1 &&
        row.singleOrDoubleArm === 'Single Arm'
      );
    case 'double':
      return (
        row.primaryEquipment === 'Kettlebell' &&
        row.primaryItemCount === 2 &&
        row.singleOrDoubleArm === 'Double Arm'
      );
    default:
      return false;
  }
};

export const getWeightModeFromCatalogFields = (
  fields: MovementWeightModeFields | null | undefined,
): WeightTabValue | null => {
  if (!fields) return null;
  const modes: WeightTabValue[] = ['none', '2h', '1h', 'double'];
  return modes.find((mode) => movementMatchesWeightMode(fields, mode)) ?? null;
};
