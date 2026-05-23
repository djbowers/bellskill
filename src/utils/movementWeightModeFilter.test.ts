import { describe, expect, test } from 'vitest';

import {
  getWeightTabValue,
  movementMatchesWeightMode,
  recentMovementMatchesWeightMode,
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

describe('recentMovementMatchesWeightMode', () => {
  test('includes movements without catalog metadata', () => {
    expect(recentMovementMatchesWeightMode(null, '2h')).toBe(true);
  });

  test('filters linked catalog movements by weight mode', () => {
    const twoHanded = row({
      primaryEquipment: 'Kettlebell',
      primaryItemCount: 1,
      singleOrDoubleArm: 'Double Arm',
    });
    const singleArm = row({
      primaryEquipment: 'Kettlebell',
      primaryItemCount: 1,
      singleOrDoubleArm: 'Single Arm',
    });

    expect(recentMovementMatchesWeightMode(twoHanded, '2h')).toBe(true);
    expect(recentMovementMatchesWeightMode(twoHanded, '1h')).toBe(false);
    expect(recentMovementMatchesWeightMode(singleArm, '1h')).toBe(true);
    expect(recentMovementMatchesWeightMode(singleArm, '2h')).toBe(false);
  });
});
