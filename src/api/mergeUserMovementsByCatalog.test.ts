import { describe, expect, test } from 'vitest';

import {
  UserMovementWithFrequency,
  mergeUserMovementsByCatalog,
} from './useUserMovementFrequency';

const row = (
  overrides: Partial<UserMovementWithFrequency>,
): UserMovementWithFrequency => ({
  id: 'um-1',
  canonicalName: 'Kettlebell Swing',
  functionalMovementId: null,
  catalogName: null,
  catalogWeightFields: null,
  logCount: 0,
  ...overrides,
});

describe('mergeUserMovementsByCatalog', () => {
  test('collapses rows sharing a catalog movement into one under the catalog name', () => {
    const merged = mergeUserMovementsByCatalog([
      row({
        id: 'um-typed',
        canonicalName: 'Double Kettlebell Front Rack Squat',
        functionalMovementId: 'mov-front-squat',
        catalogName: 'Double Kettlebell Front Squat',
        logCount: 7,
      }),
      row({
        id: 'um-catalog',
        canonicalName: 'Double Kettlebell Front Squat',
        functionalMovementId: 'mov-front-squat',
        catalogName: 'Double Kettlebell Front Squat',
        logCount: 3,
      }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: 'um-catalog',
      canonicalName: 'Double Kettlebell Front Squat',
      functionalMovementId: 'mov-front-squat',
      logCount: 10,
    });
  });

  test('shows the catalog name for a linked row authored under a different name', () => {
    const merged = mergeUserMovementsByCatalog([
      row({
        canonicalName: 'Front Squat',
        functionalMovementId: 'mov-front-squat',
        catalogName: 'Double Kettlebell Front Squat',
      }),
    ]);

    expect(merged[0].canonicalName).toBe('Double Kettlebell Front Squat');
  });

  test('leaves unlinked rows untouched, even with matching names', () => {
    const merged = mergeUserMovementsByCatalog([
      row({ id: 'um-a', canonicalName: 'Halo' }),
      row({ id: 'um-b', canonicalName: 'Halo' }),
    ]);

    expect(merged.map((m) => m.id)).toEqual(['um-a', 'um-b']);
  });
});
