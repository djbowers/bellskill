import { MovementOptions } from '~/types';
import { getWeightUnitLabel } from '~/utils';

/** The load alone — no grip marker, for pairing with a weight-mode indicator. */
export const loadSummary = (movement: MovementOptions): string | null => {
  const { weightOneValue, weightOneUnit, weightTwoValue, weightTwoUnit } =
    movement;
  if (!weightOneValue) return null;
  const one = `${weightOneValue} ${getWeightUnitLabel(weightOneUnit)}`;

  // Two bells: "16 kg ×2" when matched, otherwise spell both out.
  if (weightTwoValue && weightTwoValue > 0) {
    const two = `${weightTwoValue} ${getWeightUnitLabel(weightTwoUnit)}`;
    return weightOneValue === weightTwoValue && weightOneUnit === weightTwoUnit
      ? `${one} ×2`
      : `${one} + ${two}`;
  }
  return one;
};
