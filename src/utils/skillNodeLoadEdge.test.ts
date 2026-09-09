import { WeightUnit } from '~/types';

import { MovementWeightModeFields } from './movementWeightModeFilter';
import { LoadedMovementLog, deriveSkillNodeLoadEdges } from './skillNodeLoadEdge';

/** Node id → how the catalog says its movement is weighted. */
const CATALOG: Record<string, MovementWeightModeFields> = {
  // Two-hand swing, one bell in both hands.
  'L2-N2': {
    primaryEquipment: 'Kettlebell',
    primaryItemCount: 1,
    singleOrDoubleArm: 'Double Arm',
  },
  // Single snatch, one bell in one hand.
  'L8-N1': {
    primaryEquipment: 'Kettlebell',
    primaryItemCount: 1,
    singleOrDoubleArm: 'Single Arm',
  },
  // Double snatch, two bells.
  'L9-N1': {
    primaryEquipment: 'Kettlebell',
    primaryItemCount: 2,
    singleOrDoubleArm: 'Double Arm',
  },
};

const log = (
  skillNodeId: keyof typeof CATALOG,
  weights: {
    one: number | null;
    two?: number | null;
    unit?: WeightUnit;
    twoUnit?: WeightUnit;
  },
  startedAt = '2026-09-01T00:00:00Z',
): LoadedMovementLog => ({
  skillNodeId,
  catalogWeightFields: CATALOG[skillNodeId],
  weightOneUnit: weights.one === null ? null : (weights.unit ?? 'kilograms'),
  weightOneValue: weights.one,
  weightTwoUnit:
    weights.two === undefined || weights.two === null
      ? null
      : (weights.twoUnit ?? weights.unit ?? 'kilograms'),
  weightTwoValue: weights.two === undefined ? null : weights.two,
  startedAt: new Date(startedAt),
});

const edgeOf = (logs: LoadedMovementLog[], nodeId: string) =>
  deriveSkillNodeLoadEdges(logs).get(nodeId) ?? { edgeKg: null, reachedAt: null };

describe('deriveSkillNodeLoadEdges', () => {
  test('a node with no logs has no edge', () => {
    expect(edgeOf([], 'L2-N2')).toEqual({ edgeKg: null, reachedAt: null });
  });

  test('takes the heaviest bell logged for the node', () => {
    const logs = [
      log('L2-N2', { one: 16 }),
      log('L2-N2', { one: 24 }),
      log('L2-N2', { one: 20 }),
    ];
    expect(edgeOf(logs, 'L2-N2').edgeKg).toBe(24);
  });

  test('reads a one-hand log off the weight-two sentinel', () => {
    const logs = [log('L8-N1', { one: 24, two: 0 })];
    expect(edgeOf(logs, 'L8-N1').edgeKg).toBe(24);
  });

  test('a double log counts as its lighter bell, comparing across units', () => {
    const logs = [
      log('L9-N1', {
        one: 24,
        two: 35,
        unit: 'kilograms',
        twoUnit: 'pounds',
      }),
    ];
    expect(edgeOf(logs, 'L9-N1').edgeKg).toBe(16);
  });

  test('pound bells land on the rung they were cast as', () => {
    expect(edgeOf([log('L2-N2', { one: 53, unit: 'pounds' })], 'L2-N2').edgeKg).toBe(24);
    expect(edgeOf([log('L2-N2', { one: 35, unit: 'pounds' })], 'L2-N2').edgeKg).toBe(16);
  });

  test('ignores logs weighted differently from the catalog hand mode', () => {
    const bodyweight = log('L2-N2', { one: null });
    const asDouble = log('L2-N2', { one: 32, two: 32 });
    expect(edgeOf([bodyweight, asDouble], 'L2-N2').edgeKg).toBeNull();
  });

  test('keeps each node’s bells to itself', () => {
    const logs = [log('L8-N1', { one: 32, two: 0 })];
    expect(edgeOf(logs, 'L2-N2').edgeKg).toBeNull();
    expect(edgeOf(logs, 'L8-N1').edgeKg).toBe(32);
  });

  test('dates the edge from the first session at that bell', () => {
    const logs = [
      log('L2-N2', { one: 24 }, '2026-08-20T00:00:00Z'),
      log('L2-N2', { one: 24 }, '2026-07-04T00:00:00Z'),
      log('L2-N2', { one: 16 }, '2026-06-01T00:00:00Z'),
    ];
    expect(edgeOf(logs, 'L2-N2')).toEqual({
      edgeKg: 24,
      reachedAt: new Date('2026-07-04T00:00:00Z'),
    });
  });
});
