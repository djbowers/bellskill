import { MovementOptions, WeightTabValue } from '~/types';

export interface MovementWeightModeFields {
  primaryEquipment: string | null;
  primaryItemCount: number | null;
  singleOrDoubleArm: string | null;
}

export const WEIGHT_MODE_LABELS: Record<WeightTabValue, string> = {
  none: 'Bodyweight',
  '2h': '2H',
  '1h': '1H',
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

export const recentMovementMatchesWeightMode = (
  catalogWeightFields: MovementWeightModeFields | null,
  mode: WeightTabValue,
): boolean => {
  if (!catalogWeightFields) return true;
  return movementMatchesWeightMode(catalogWeightFields, mode);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const applyWeightModeToCatalogQuery = (query: any, mode: WeightTabValue) => {
  switch (mode) {
    case 'none':
      return query.eq('primary_equipment', 'Bodyweight');
    case '2h':
      return query
        .eq('primary_equipment', 'Kettlebell')
        .eq('primary_item_count', 1)
        .eq('single_or_double_arm', 'Double Arm');
    case '1h':
      return query
        .eq('primary_equipment', 'Kettlebell')
        .eq('primary_item_count', 1)
        .eq('single_or_double_arm', 'Single Arm');
    case 'double':
      return query
        .eq('primary_equipment', 'Kettlebell')
        .eq('primary_item_count', 2)
        .eq('single_or_double_arm', 'Double Arm');
    default:
      return query;
  }
};

// Legacy column names for the movements table (used outside catalog search).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const applyWeightModeToMovementsQuery = (query: any, mode: WeightTabValue) => {
  switch (mode) {
    case 'none':
      return query.eq('Primary Equipment', 'Bodyweight');
    case '2h':
      return query
        .eq('Primary Equipment', 'Kettlebell')
        .eq('Single or Double Arm', 'Double Arm');
    case '1h':
      return query
        .eq('Primary Equipment', 'Kettlebell')
        .eq('Single or Double Arm', 'Single Arm');
    case 'double':
      return query
        .eq('Primary Equipment', 'Kettlebell')
        .eq('Single or Double Arm', 'Double Arm');
    default:
      return query;
  }
};
