import { describe, expect, it } from 'vitest';

import { WeightSlots, applyWeightMode } from './applyWeightMode';

const DEFAULTS = { value: 16, unit: 'kilograms' as const };

const slots = (overrides: Partial<WeightSlots> = {}): WeightSlots => ({
  weightOneUnit: null,
  weightOneValue: null,
  weightTwoUnit: null,
  weightTwoValue: null,
  ...overrides,
});

describe('applyWeightMode', () => {
  it('clears both slots for bodyweight', () => {
    const result = applyWeightMode(
      slots({ weightOneUnit: 'kilograms', weightOneValue: 24 }),
      'none',
      DEFAULTS,
    );

    expect(result).toEqual(slots());
  });

  it('leaves the second slot null for two-hand', () => {
    const result = applyWeightMode(slots(), '2h', DEFAULTS);

    expect(result.weightOneValue).toBe(16);
    expect(result.weightOneUnit).toBe('kilograms');
    expect(result.weightTwoValue).toBeNull();
    expect(result.weightTwoUnit).toBeNull();
  });

  it('zeroes the second slot for single-arm', () => {
    const result = applyWeightMode(slots(), '1h', DEFAULTS);

    expect(result.weightTwoValue).toBe(0);
    expect(result.weightTwoUnit).toBeNull();
  });

  it('mirrors the first slot into the second for double', () => {
    const result = applyWeightMode(
      slots({ weightOneUnit: 'pounds', weightOneValue: 35 }),
      'double',
      DEFAULTS,
    );

    expect(result).toEqual({
      weightOneUnit: 'pounds',
      weightOneValue: 35,
      weightTwoUnit: 'pounds',
      weightTwoValue: 35,
    });
  });

  it('carries over an existing weight rather than resetting it', () => {
    const result = applyWeightMode(
      slots({ weightOneUnit: 'pounds', weightOneValue: 53 }),
      '1h',
      DEFAULTS,
    );

    expect(result.weightOneValue).toBe(53);
    expect(result.weightOneUnit).toBe('pounds');
  });

  it('keeps a distinct second weight when switching into double', () => {
    const result = applyWeightMode(
      slots({
        weightOneUnit: 'kilograms',
        weightOneValue: 24,
        weightTwoUnit: 'kilograms',
        weightTwoValue: 20,
      }),
      'double',
      DEFAULTS,
    );

    expect(result.weightTwoValue).toBe(20);
  });

  it('preserves unrelated fields on the movement', () => {
    const result = applyWeightMode(
      { ...slots(), movementName: 'Kettlebell Swing', repScheme: [5] },
      '2h',
      DEFAULTS,
    );

    expect(result.movementName).toBe('Kettlebell Swing');
    expect(result.repScheme).toEqual([5]);
  });
});
