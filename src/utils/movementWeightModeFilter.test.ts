import { describe, expect, test } from 'vitest';

import {
  getWeightModeFromCatalogFields,
  getWeightTabValue,
  movementMatchesWeightMode,
  type MovementWeightModeFields,
} from './movementWeightModeFilter';

const row = (
  overrides: Partial<MovementWeightModeFields>,
): MovementWeightModeFields => ({
  primaryEquipment: null,
  primaryItemCount: null,
  singleOrDoubleArm: null,
  ...overrides,
});

describe('getWeightTabValue', () => {
  test('none when no weight', () => {
    expect(getWeightTabValue({ weightOneValue: null, weightTwoValue: null })).toBe(
      'none',
    );
  });

  test('2h when one weight value', () => {
    expect(getWeightTabValue({ weightOneValue: 16, weightTwoValue: null })).toBe('2h');
  });

  test('1h when second weight is zero', () => {
    expect(getWeightTabValue({ weightOneValue: 16, weightTwoValue: 0 })).toBe('1h');
  });

  test('double when two weight values', () => {
    expect(getWeightTabValue({ weightOneValue: 16, weightTwoValue: 16 })).toBe(
      'double',
    );
  });
});

describe('movementMatchesWeightMode', () => {
  test('none matches bodyweight only', () => {
    expect(
      movementMatchesWeightMode(
        row({ primaryEquipment: 'Bodyweight' }),
        'none',
      ),
    ).toBe(true);
    expect(
      movementMatchesWeightMode(
        row({ primaryEquipment: 'Kettlebell', primaryItemCount: 1 }),
        'none',
      ),
    ).toBe(false);
  });

  test('2h matches one kettlebell double-arm', () => {
    expect(
      movementMatchesWeightMode(
        row({
          primaryEquipment: 'Kettlebell',
          primaryItemCount: 1,
          singleOrDoubleArm: 'Double Arm',
        }),
        '2h',
      ),
    ).toBe(true);
    expect(
      movementMatchesWeightMode(
        row({
          primaryEquipment: 'Kettlebell',
          primaryItemCount: 1,
          singleOrDoubleArm: 'No Arms',
        }),
        '2h',
      ),
    ).toBe(false);
    expect(
      movementMatchesWeightMode(
        row({
          primaryEquipment: 'Kettlebell',
          primaryItemCount: 1,
          singleOrDoubleArm: 'Single Arm',
        }),
        '2h',
      ),
    ).toBe(false);
  });

  test('1h matches one kettlebell single-arm', () => {
    expect(
      movementMatchesWeightMode(
        row({
          primaryEquipment: 'Kettlebell',
          primaryItemCount: 1,
          singleOrDoubleArm: 'Single Arm',
        }),
        '1h',
      ),
    ).toBe(true);
    expect(
      movementMatchesWeightMode(
        row({
          primaryEquipment: 'Kettlebell',
          primaryItemCount: 2,
          singleOrDoubleArm: 'Single Arm',
        }),
        '1h',
      ),
    ).toBe(false);
  });

  test('double matches two kettlebells double-arm', () => {
    expect(
      movementMatchesWeightMode(
        row({
          primaryEquipment: 'Kettlebell',
          primaryItemCount: 2,
          singleOrDoubleArm: 'Double Arm',
        }),
        'double',
      ),
    ).toBe(true);
    expect(
      movementMatchesWeightMode(
        row({
          primaryEquipment: 'Kettlebell',
          primaryItemCount: 2,
          singleOrDoubleArm: 'No Arms',
        }),
        'double',
      ),
    ).toBe(false);
    expect(
      movementMatchesWeightMode(
        row({
          primaryEquipment: 'Kettlebell',
          primaryItemCount: 1,
          singleOrDoubleArm: 'Double Arm',
        }),
        'double',
      ),
    ).toBe(false);
  });
});

describe('getWeightModeFromCatalogFields', () => {
  test('derives each weight mode from the catalog fields', () => {
    expect(
      getWeightModeFromCatalogFields(row({ primaryEquipment: 'Bodyweight' })),
    ).toBe('none');
    expect(
      getWeightModeFromCatalogFields(
        row({
          primaryEquipment: 'Kettlebell',
          primaryItemCount: 1,
          singleOrDoubleArm: 'Double Arm',
        }),
      ),
    ).toBe('2h');
    expect(
      getWeightModeFromCatalogFields(
        row({
          primaryEquipment: 'Kettlebell',
          primaryItemCount: 1,
          singleOrDoubleArm: 'Single Arm',
        }),
      ),
    ).toBe('1h');
    expect(
      getWeightModeFromCatalogFields(
        row({
          primaryEquipment: 'Kettlebell',
          primaryItemCount: 2,
          singleOrDoubleArm: 'Double Arm',
        }),
      ),
    ).toBe('double');
  });

  test('returns null without catalog metadata', () => {
    expect(getWeightModeFromCatalogFields(null)).toBeNull();
    expect(getWeightModeFromCatalogFields(undefined)).toBeNull();
  });

  // Bodyweight rows still carry an arm split (Side Plank Hip Dip is
  // Bodyweight/Single Arm), so equipment has to win or they'd derive 1h and
  // pick up a phantom bell.
  test('reads a single-arm bodyweight row as bodyweight, not single', () => {
    expect(
      getWeightModeFromCatalogFields(
        row({
          primaryEquipment: 'Bodyweight',
          primaryItemCount: 1,
          singleOrDoubleArm: 'Single Arm',
        }),
      ),
    ).toBe('none');
  });

  test('returns null for a row that maps to no mode', () => {
    expect(
      getWeightModeFromCatalogFields(
        row({
          primaryEquipment: 'Barbell',
          primaryItemCount: 1,
          singleOrDoubleArm: 'Double Arm',
        }),
      ),
    ).toBeNull();
  });
});
