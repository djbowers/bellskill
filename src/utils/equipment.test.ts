import { describe, expect, it } from 'vitest';

import {
  EquipmentRow,
  allLoadableWeights,
  summarizeEquipment,
  validateSessionWeights,
} from './equipment';

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
      fixed_weights: [{ weight_kg: 24, count: 1, doubles: false }],
      adjustable_bells: [],
      adjustable_bell_count: 0,
      description: '24 kg',
    });
  });

  it('marks doubles for a pair', () => {
    const summary = summarizeEquipment([fixed(16, { quantity: 2 })]);

    expect(summary?.fixed_weights).toEqual([
      { weight_kg: 16, count: 2, doubles: true },
    ]);
    expect(summary?.description).toBe('16 kg (pair)');
  });

  it('marks doubles when two separate rows land on the same weight', () => {
    const summary = summarizeEquipment([fixed(16), fixed(16)]);

    expect(summary?.fixed_weights).toEqual([
      { weight_kg: 16, count: 2, doubles: true },
    ]);
  });

  it('converts pounds to kilograms rounded to the nearest half', () => {
    const summary = summarizeEquipment([fixed(35, { unit: 'pounds' })]);

    expect(summary?.fixed_weights).toEqual([
      { weight_kg: 16, count: 1, doubles: false },
    ]);
    expect(summary?.description).toBe('35 lb');
  });

  it('keeps an adjustable bell as one bell holding a menu of settings', () => {
    const summary = summarizeEquipment([adjustable(12, 20, 4)]);

    // Not flattened into the fixed list: an adjustable bell is one bell that
    // holds a single setting per session, not three freely usable weights.
    expect(summary?.fixed_weights).toEqual([]);
    expect(summary?.adjustable_bells).toEqual([
      { count: 1, settings_kg: [12, 16, 20] },
    ]);
    expect(summary?.adjustable_bell_count).toBe(1);
    expect(summary?.description).toBe('adjustable 12–20 kg (4 kg steps)');
  });

  it('counts a pair of adjustable bells as two per-session settings', () => {
    const summary = summarizeEquipment([
      adjustable(12, 20, 4, { quantity: 2 }),
    ]);

    expect(summary?.adjustable_bells).toEqual([
      { count: 2, settings_kg: [12, 16, 20] },
    ]);
    expect(summary?.adjustable_bell_count).toBe(2);
    expect(summary?.description).toBe('adjustable 12–20 kg (×2, 4 kg steps)');
  });

  it('caps runaway adjustable ranges', () => {
    const summary = summarizeEquipment([adjustable(1, 1000, 0.5)]);

    expect(summary?.adjustable_bells[0].settings_kg.length).toBeLessThanOrEqual(
      100,
    );
  });

  it('keeps fixed and adjustable separate for mixed equipment', () => {
    const summary = summarizeEquipment([
      fixed(32),
      fixed(16),
      adjustable(12, 20, 4),
    ]);

    expect(summary?.fixed_weights).toEqual([
      { weight_kg: 16, count: 1, doubles: false },
      { weight_kg: 32, count: 1, doubles: false },
    ]);
    expect(summary?.adjustable_bells).toEqual([
      { count: 1, settings_kg: [12, 16, 20] },
    ]);
    expect(summary?.description).toBe(
      '32 kg, 16 kg, adjustable 12–20 kg (4 kg steps)',
    );
  });

  it('ignores rows with missing weights', () => {
    expect(summarizeEquipment([fixed(null as unknown as number)])).toBeNull();
  });
});

describe('allLoadableWeights', () => {
  it('unions fixed and adjustable weights for coverage display', () => {
    const summary = summarizeEquipment([
      fixed(16, { quantity: 2 }),
      adjustable(12, 20, 4),
    ])!;

    expect(allLoadableWeights(summary)).toEqual([
      { weight_kg: 12, doubles: false },
      { weight_kg: 16, doubles: true },
      { weight_kg: 20, doubles: false },
    ]);
  });
});

describe('validateSessionWeights', () => {
  const summary = (rows: EquipmentRow[]) => summarizeEquipment(rows)!;

  it('accepts fixed weights with no adjustable settings declared', () => {
    const owned = summary([fixed(16, { quantity: 2 }), fixed(24)]);

    expect(validateSessionWeights(owned, [16, 24, 16], [])).toEqual([]);
  });

  it('rejects a weight the lifter does not own', () => {
    const owned = summary([fixed(16)]);

    expect(validateSessionWeights(owned, [16, 20], [])).toEqual([
      '20kg is not a weight the lifter owns',
    ]);
  });

  it('rejects an adjustable weight that was never declared', () => {
    const owned = summary([adjustable(12, 32, 2)]);

    expect(validateSessionWeights(owned, [24], [])).toEqual([
      '24kg is only reachable by re-plating an adjustable bell mid-session — either declare it as an adjustable setting for the whole session or use a weight already in use',
    ]);
  });

  it('accepts blocks that all use the declared adjustable setting', () => {
    const owned = summary([adjustable(12, 32, 2)]);

    expect(validateSessionWeights(owned, [24, 24, 24], [24])).toEqual([]);
  });

  it('rejects declaring more settings than the lifter has bells', () => {
    const owned = summary([adjustable(12, 32, 2)]);

    expect(validateSessionWeights(owned, [16, 24], [16, 24])).toEqual([
      'the session sets 2 adjustable weights but the lifter owns only 1 adjustable bell(s) — each bell holds one setting for the whole session',
    ]);
  });

  it('lets two adjustable bells hold two different settings', () => {
    const owned = summary([adjustable(12, 32, 2, { quantity: 2 })]);

    expect(validateSessionWeights(owned, [16, 24], [16, 24])).toEqual([]);
  });

  it('lets both adjustable bells sit at the same weight for doubles', () => {
    const owned = summary([adjustable(12, 32, 2, { quantity: 2 })]);

    expect(validateSessionWeights(owned, [24], [24, 24])).toEqual([]);
  });

  it('rejects a setting no single bell can reach', () => {
    const owned = summary([adjustable(12, 20, 4), adjustable(24, 32, 4)]);

    expect(validateSessionWeights(owned, [36], [36])).toEqual([
      "the adjustable settings (36kg) cannot all be set on the lifter's adjustable bells at once",
    ]);
  });

  it('rejects spanning two bells to reach one weight', () => {
    // 12–20 and 24–32 are separate bells; neither reaches 22kg.
    const owned = summary([adjustable(12, 20, 4), adjustable(24, 32, 4)]);

    expect(validateSessionWeights(owned, [22], [])).toEqual([
      '22kg is not a weight the lifter owns',
    ]);
  });

  it('matches settings to the bells that can hold them, not just the first', () => {
    // A greedy pass could hand 20kg to the wide bell and strand 28kg.
    const owned = summary([adjustable(12, 32, 4), adjustable(16, 20, 4)]);

    expect(validateSessionWeights(owned, [20, 28], [20, 28])).toEqual([]);
  });

  it('mixes fixed bells with a declared adjustable setting', () => {
    const owned = summary([fixed(16, { quantity: 2 }), adjustable(12, 32, 2)]);

    expect(validateSessionWeights(owned, [16, 28, 16], [28])).toEqual([]);
  });
});
