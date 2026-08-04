import { describe, expect, it } from 'vitest';

import { EquipmentRow, summarizeEquipment } from './equipment';

const fixed = (weight: number, overrides: Partial<EquipmentRow> = {}) => ({
  kind: 'fixed' as const,
  weight,
  minWeight: null,
  maxWeight: null,
  stepWeight: null,
  unit: 'kilograms' as const,
  quantity: 1,
  ...overrides,
});

const adjustable = (
  minWeight: number,
  maxWeight: number,
  stepWeight: number,
  overrides: Partial<EquipmentRow> = {},
) => ({
  kind: 'adjustable' as const,
  weight: null,
  minWeight,
  maxWeight,
  stepWeight,
  unit: 'kilograms' as const,
  quantity: 1,
  ...overrides,
});

describe('summarizeEquipment', () => {
  it('returns null when nothing is recorded', () => {
    expect(summarizeEquipment([])).toBeNull();
  });

  it('expands a single fixed bell', () => {
    expect(summarizeEquipment([fixed(24)])).toEqual({
      available_weights: [{ weight_kg: 24, doubles: false }],
      description: '24 kg',
    });
  });

  it('marks doubles for a pair', () => {
    const summary = summarizeEquipment([fixed(16, { quantity: 2 })]);

    expect(summary?.available_weights).toEqual([
      { weight_kg: 16, doubles: true },
    ]);
    expect(summary?.description).toBe('16 kg (pair)');
  });

  it('marks doubles when two separate rows land on the same weight', () => {
    const summary = summarizeEquipment([fixed(16), fixed(16)]);

    expect(summary?.available_weights).toEqual([
      { weight_kg: 16, doubles: true },
    ]);
  });

  it('converts pounds to kilograms rounded to the nearest half', () => {
    const summary = summarizeEquipment([fixed(35, { unit: 'pounds' })]);

    expect(summary?.available_weights).toEqual([
      { weight_kg: 16, doubles: false },
    ]);
    expect(summary?.description).toBe('35 lb');
  });

  it('expands an adjustable bell into every step', () => {
    const summary = summarizeEquipment([adjustable(12, 20, 4)]);

    expect(summary?.available_weights.map((w) => w.weight_kg)).toEqual([
      12, 16, 20,
    ]);
    expect(summary?.available_weights.every((w) => !w.doubles)).toBe(true);
    expect(summary?.description).toBe('adjustable 12–20 kg (4 kg steps)');
  });

  it('marks every step as doubles for a pair of adjustable bells', () => {
    const summary = summarizeEquipment([
      adjustable(12, 20, 4, { quantity: 2 }),
    ]);

    expect(summary?.available_weights.every((w) => w.doubles)).toBe(true);
    expect(summary?.description).toBe('adjustable 12–20 kg (×2, 4 kg steps)');
  });

  it('caps runaway adjustable ranges', () => {
    const summary = summarizeEquipment([adjustable(1, 1000, 0.5)]);

    expect(summary?.available_weights.length).toBeLessThanOrEqual(100);
  });

  it('dedupes across mixed equipment and sorts ascending', () => {
    const summary = summarizeEquipment([
      fixed(32),
      fixed(16),
      adjustable(12, 20, 4),
    ]);

    expect(summary?.available_weights).toEqual([
      { weight_kg: 12, doubles: false },
      { weight_kg: 16, doubles: true },
      { weight_kg: 20, doubles: false },
      { weight_kg: 32, doubles: false },
    ]);
    expect(summary?.description).toBe(
      '32 kg, 16 kg, adjustable 12–20 kg (4 kg steps)',
    );
  });

  it('ignores rows with missing weights', () => {
    expect(summarizeEquipment([fixed(null as unknown as number)])).toBeNull();
  });
});
