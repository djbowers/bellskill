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
        row.singleOrDoubleArm !== 'Single Arm'
      );
    case '1h':
      return (
        row.primaryEquipment === 'Kettlebell' &&
        row.singleOrDoubleArm === 'Single Arm'
      );
    case 'double':
      return (
        row.primaryEquipment === 'Kettlebell' &&
        (row.primaryItemCount === 2 || row.singleOrDoubleArm === 'Double Arm')
      );
    default:
      return false;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const applyWeightModeToMovementsQuery = (query: any, mode: WeightTabValue) => {
  switch (mode) {
    case 'none':
      return query.eq('Primary Equipment', 'Bodyweight');
    case '2h':
      return query
        .eq('Primary Equipment', 'Kettlebell')
        .eq('# Primary Items', 1)
        .neq('Single or Double Arm', 'Single Arm');
    case '1h':
      return query
        .eq('Primary Equipment', 'Kettlebell')
        .eq('Single or Double Arm', 'Single Arm');
    case 'double':
      return query
        .eq('Primary Equipment', 'Kettlebell')
        .or('# Primary Items.eq.2,"Single or Double Arm".eq.Double Arm');
    default:
      return query;
  }
};
