import { MovementAggregate } from './patternDebt';

import {
  attributeMovementModality,
  computeModalityBalance,
  computeOverallModalityBalance,
} from './modalityDebt';

const NOW = new Date('2026-06-24T12:00:00Z');
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const mov = (over: Partial<MovementAggregate>): MovementAggregate => ({
  movement_id: 'm1',
  movement_name: 'Movement',
  pattern_credits: null,
  modality_credits: null,
  last_trained_at: null,
  set_count: 0,
  total_reps: 0,
  total_volume_kg: 0,
  baseline_volume_kg: null,
  ...over,
});

describe('attributeMovementModality', () => {
  test('explicit credits pass through deduped, filtering unknown strings', () => {
    expect(attributeMovementModality(['ballistic', 'conditioning'])).toEqual([
      'ballistic',
      'conditioning',
    ]);
    expect(
      attributeMovementModality(['grind', 'bogus', 'grind']),
    ).toEqual(['grind']);
  });

  test('null / undefined / empty credits -> [] (no name fallback)', () => {
    expect(attributeMovementModality(null)).toEqual([]);
    expect(attributeMovementModality(undefined)).toEqual([]);
    expect(attributeMovementModality([])).toEqual([]);
  });
});

describe('computeOverallModalityBalance', () => {
  test('empty -> balanced', () => {
    expect(computeOverallModalityBalance([])).toBe('balanced');
  });
});

describe('computeModalityBalance', () => {
  test('returns all four modalities with no data, every one isNew, balanced', () => {
    const { modalities, overallBalance } = computeModalityBalance([], NOW);
    expect(Object.keys(modalities).sort()).toEqual(
      ['ballistic', 'conditioning', 'grind', 'mobility'].sort(),
    );
    expect(Object.values(modalities).every((m) => m.isNew)).toBe(true);
    expect(overallBalance).toBe('balanced');
  });

  test('multi-credit movement pays full volume into every credited modality', () => {
    const { modalities } = computeModalityBalance(
      [
        mov({
          movement_name: 'Kettlebell Snatch',
          modality_credits: ['ballistic', 'conditioning'],
          last_trained_at: daysAgo(2),
          total_volume_kg: 480,
          baseline_volume_kg: 480,
        }),
      ],
      NOW,
    );
    for (const modality of ['ballistic', 'conditioning'] as const) {
      expect(modalities[modality].recentVolume).toBe(480);
      expect(modalities[modality].baselineVolume).toBe(480);
      expect(modalities[modality].isNew).toBe(false);
      expect(modalities[modality].band).toBe('green');
    }
    expect(modalities.grind.isNew).toBe(true);
    expect(modalities.mobility.isNew).toBe(true);
  });

  test('unlinked get-up-named row with null credits attributes to nothing', () => {
    const { modalities } = computeModalityBalance(
      [
        mov({
          movement_id: null,
          movement_name: 'Turkish Get Up',
          modality_credits: null,
          last_trained_at: daysAgo(1),
          total_volume_kg: 300,
          baseline_volume_kg: 300,
        }),
      ],
      NOW,
    );
    expect(Object.values(modalities).every((m) => m.isNew)).toBe(true);
  });

  test('volumes and latest lastTrained accumulate across rows; hardest RPE wins', () => {
    const { modalities } = computeModalityBalance(
      [
        mov({
          movement_name: 'Kettlebell Military Press',
          modality_credits: ['grind'],
          last_trained_at: daysAgo(6),
          total_volume_kg: 200,
          baseline_volume_kg: 300,
          hardest_rpe: 'easy',
        }),
        mov({
          movement_id: 'm2',
          movement_name: 'Goblet Squat',
          modality_credits: ['grind'],
          last_trained_at: daysAgo(2),
          total_volume_kg: 100,
          baseline_volume_kg: 100,
          hardest_rpe: 'hard',
        }),
      ],
      NOW,
    );
    const grind = modalities.grind;
    expect(grind.recentVolume).toBe(300);
    expect(grind.baselineVolume).toBe(400);
    expect(grind.daysSinceLastTrained).toBe(2);
    expect(grind.hardestRpe).toBe('hard');
  });

  test('idle modality with baseline history goes red, not New', () => {
    const { modalities } = computeModalityBalance(
      [
        mov({
          movement_name: 'Kettlebell Swing',
          modality_credits: ['ballistic', 'conditioning'],
          last_trained_at: null, // outside the recent window
          total_volume_kg: 0,
          baseline_volume_kg: 500,
        }),
      ],
      NOW,
    );
    expect(modalities.ballistic.isNew).toBe(false);
    expect(modalities.ballistic.debtScore).toBe(100);
    expect(modalities.ballistic.band).toBe('red');
  });

  test('skew -> <modality>-heavy when spread >= 25', () => {
    const { overallBalance } = computeModalityBalance(
      [
        mov({
          movement_name: 'Kettlebell Front Squat',
          modality_credits: ['grind'],
          last_trained_at: daysAgo(1),
          total_volume_kg: 1000,
          baseline_volume_kg: 1000,
        }),
        mov({
          movement_id: 'm2',
          movement_name: 'Kettlebell Swing',
          modality_credits: ['ballistic', 'conditioning'],
          last_trained_at: daysAgo(12),
          total_volume_kg: 50,
          baseline_volume_kg: 800,
        }),
        mov({
          movement_id: 'm3',
          movement_name: 'Kettlebell Halo',
          modality_credits: ['mobility'],
          last_trained_at: daysAgo(13),
          total_volume_kg: 10,
          baseline_volume_kg: 200,
        }),
      ],
      NOW,
    );
    expect(overallBalance).toBe('grind-heavy');
  });
});

describe('computeModalityBalance — bodyweight & timed rows', () => {
  test('bodyweight-only modality scores on its rep baseline', () => {
    const { modalities } = computeModalityBalance(
      [
        mov({
          movement_name: 'Push-Up',
          modality_credits: ['grind'],
          last_trained_at: daysAgo(10),
          total_unloaded_reps: 200,
          baseline_unloaded_reps: 400,
        }),
      ],
      NOW,
    );
    expect(modalities.grind.debtScore).toBe(63);
    expect(modalities.grind.band).toBe('yellow');
  });

  test('timed-only modality scores on its seconds baseline', () => {
    const { modalities } = computeModalityBalance(
      [
        mov({
          movement_name: 'Plank',
          modality_credits: ['conditioning'],
          last_trained_at: daysAgo(2),
          total_seconds: 60,
          baseline_seconds: 120,
        }),
      ],
      NOW,
    );
    expect(modalities.conditioning.debtScore).toBe(29);
  });
});
