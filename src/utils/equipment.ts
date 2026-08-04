// Turns the user's declared kettlebell inventory (`user_equipment`) into the set
// of weights they can actually load. Pure + deterministic so it can be unit-tested
// here and reused verbatim by the recommender edge functions.

const POUNDS_TO_KG = 0.45359237;

/** An adjustable bell with a tiny step over a wide range would otherwise expand
 * into thousands of settings; the recommender only needs a usable spread. */
const MAX_SETTINGS_PER_ROW = 100;

export type EquipmentUnit = 'kilograms' | 'pounds';

export interface EquipmentRow {
  kind: 'fixed' | 'adjustable';
  weight: number | null;
  minWeight: number | null;
  maxWeight: number | null;
  stepWeight: number | null;
  unit: EquipmentUnit;
  quantity: number;
}

export interface AvailableWeight {
  weight_kg: number;
  /** Two bells can be loaded at this weight, so doubles work here. */
  doubles: boolean;
}

export interface EquipmentSummary {
  available_weights: AvailableWeight[];
  description: string;
}

const toKg = (value: number, unit: EquipmentUnit): number => {
  const kg = unit === 'pounds' ? value * POUNDS_TO_KG : value;
  return Math.round(kg * 2) / 2;
};

const unitLabel = (unit: EquipmentUnit): string =>
  unit === 'pounds' ? 'lb' : 'kg';

const settingsForRow = (row: EquipmentRow): number[] => {
  if (row.kind === 'fixed') {
    return row.weight === null ? [] : [toKg(row.weight, row.unit)];
  }

  const { minWeight, maxWeight, stepWeight } = row;
  if (minWeight === null || maxWeight === null || stepWeight === null) return [];
  if (stepWeight <= 0 || maxWeight < minWeight) return [];

  const settings: number[] = [];
  for (
    let value = minWeight;
    value <= maxWeight + 1e-9 && settings.length < MAX_SETTINGS_PER_ROW;
    value += stepWeight
  ) {
    settings.push(toKg(value, row.unit));
  }
  return settings;
};

const describeRow = (row: EquipmentRow): string | null => {
  const label = unitLabel(row.unit);

  if (row.kind === 'fixed') {
    if (row.weight === null) return null;
    const base = `${row.weight} ${label}`;
    if (row.quantity === 2) return `${base} (pair)`;
    if (row.quantity > 2) return `${base} (×${row.quantity})`;
    return base;
  }

  if (row.minWeight === null || row.maxWeight === null) return null;
  const range = `adjustable ${row.minWeight}–${row.maxWeight} ${label}`;
  const details: string[] = [];
  if (row.quantity > 1) details.push(`×${row.quantity}`);
  if (row.stepWeight !== null)
    details.push(`${row.stepWeight} ${label} steps`);
  return details.length ? `${range} (${details.join(', ')})` : range;
};

/**
 * Expands owned bells into every loadable weight in kilograms, flagging the ones
 * where a second bell is available. Returns null when nothing is recorded, so
 * callers can omit the section entirely.
 */
export const summarizeEquipment = (
  rows: EquipmentRow[],
): EquipmentSummary | null => {
  if (rows.length === 0) return null;

  const countByWeight = new Map<number, number>();
  const descriptions: string[] = [];

  for (const row of rows) {
    const quantity = Math.max(1, row.quantity);
    for (const setting of settingsForRow(row)) {
      countByWeight.set(setting, (countByWeight.get(setting) ?? 0) + quantity);
    }
    const description = describeRow(row);
    if (description) descriptions.push(description);
  }

  if (countByWeight.size === 0) return null;

  const available_weights = [...countByWeight.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weight_kg, count]) => ({ weight_kg, doubles: count >= 2 }));

  return { available_weights, description: descriptions.join(', ') };
};
