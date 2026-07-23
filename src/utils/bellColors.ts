import { WeightUnit } from '~/types';

/**
 * Competition kettlebells are color-coded by size, so a lifter picks a bell out
 * of a rack by color before reading its number. Pound sizes name the same
 * physical bells — a 35 lb bell *is* the 16 kg bell — so both names of one bell
 * live on the same row rather than being derived by unit conversion.
 */
const BELLS = [
  { kilograms: 8, pounds: 18, color: '#e8639b' },
  { kilograms: 12, pounds: 26, color: '#3a7bd5' },
  { kilograms: 16, pounds: 35, color: '#e8c33a' },
  { kilograms: 20, pounds: 44, color: '#7b4fb5' },
  { kilograms: 24, pounds: 53, color: '#3fa45b' },
  { kilograms: 28, pounds: 62, color: '#e88b2e' },
  { kilograms: 32, pounds: 70, color: '#d64545' },
  { kilograms: 36, pounds: 79, color: '#8a8f94' },
  { kilograms: 40, pounds: 88, color: '#efede8' },
  { kilograms: 44, pounds: 97, color: '#4a4f55' },
  { kilograms: 48, pounds: 106, color: '#2e6f8e' },
];

const COLORS_BY_UNIT: Record<WeightUnit, Map<number, string>> = {
  kilograms: new Map(BELLS.map(({ kilograms, color }) => [kilograms, color])),
  pounds: new Map(BELLS.map(({ pounds, color }) => [pounds, color])),
};

export const getBellColor = (
  value: number,
  unit: WeightUnit | null,
): string | null => (unit ? (COLORS_BY_UNIT[unit].get(value) ?? null) : null);
