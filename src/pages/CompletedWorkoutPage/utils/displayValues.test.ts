import {
  getCompactRepScheme,
  getMovementTotalReps,
  getMovementVolume,
  getRepSchemeDisplayValue,
  getWeightsDisplayValue,
} from './displayValues';

describe('weights display value', () => {
  test('returns one-handed weight as string', () => {
    expect(getWeightsDisplayValue(24, 'kilograms', 0, 'kilograms')).toBe(
      '24 kg (1h)',
    );
  });

  test('returns one-handed weight as string with pounds', () => {
    expect(getWeightsDisplayValue(24, 'pounds', 0, null)).toBe('24 lb (1h)');
  });

  test('returns two-handed weight as string', () => {
    expect(getWeightsDisplayValue(24, 'kilograms', null, null)).toBe(
      '24 kg (2h)',
    );
  });

  test('returns two bell weights separated by slash', () => {
    expect(getWeightsDisplayValue(24, 'kilograms', 16, 'kilograms')).toBe(
      '24 kg, 16 kg',
    );
  });

  test('returns bw when both weights are null', () => {
    expect(getWeightsDisplayValue(null, null, null, null)).toBe('bw');
  });
});

describe('getRepSchemeDisplayValue', () => {
  test('returns single rep count as string for double bells', () => {
    expect(getRepSchemeDisplayValue([5], [24, 24])).toBe('5');
  });

  test('returns multiple rep counts separated by comma for double bells', () => {
    expect(getRepSchemeDisplayValue([5, 3, 2], [24, 24])).toBe('5, 3, 2');
  });

  test('duplicates reps for unilateral (single bell) exercises', () => {
    expect(getRepSchemeDisplayValue([5, 3], [24, 0])).toBe('5 / 5, 3 / 3');
  });

  test('returns single rep count as is when no bells specified', () => {
    expect(getRepSchemeDisplayValue([5], [0, 0])).toBe('5');
  });
});

describe('getMovementTotalReps', () => {
  test('multiplies rep scheme sum by completed rounds', () => {
    expect(getMovementTotalReps([5, 3], 4)).toBe(32);
  });
});

describe('getMovementVolume', () => {
  test('returns total kg for loaded movements', () => {
    expect(
      getMovementVolume(
        {
          repScheme: [5],
          weightOneValue: 16,
          weightTwoValue: 0,
        },
        10,
      ),
    ).toBe(800);
  });

  test('returns null for bodyweight movements', () => {
    expect(
      getMovementVolume(
        {
          repScheme: [5],
          weightOneValue: null,
          weightTwoValue: null,
        },
        10,
      ),
    ).toBeNull();
  });
});

describe('getCompactRepScheme', () => {
  test('formats uniform rep scheme with rung count multiplier', () => {
    expect(getCompactRepScheme([5], 4)).toBe('5 reps × 4');
  });

  test('uses singular rep when rung value is 1', () => {
    expect(getCompactRepScheme([1], 3)).toBe('1 rep × 3');
  });

  test('falls back to ladder format for non-uniform schemes', () => {
    expect(getCompactRepScheme([3, 2, 1], 4)).toBe('3, 2, 1 reps × 4');
  });
});
