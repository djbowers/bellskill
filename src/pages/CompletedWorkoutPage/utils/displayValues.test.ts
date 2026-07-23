import {
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

  // Timed rungs hold SECONDS. Without formatting, a 5-second carry renders as
  // a bare "5 / 5" in history and reads as five reps.
  test('formats timed rungs as durations', () => {
    expect(getRepSchemeDisplayValue([5, 60, 90], [24, 24], true)).toBe(
      '0:05, 1:00, 1:30',
    );
  });

  test('duplicates timed rungs per hand for unilateral carries', () => {
    expect(getRepSchemeDisplayValue([5, 60], [24, 0], true)).toBe(
      '0:05 / 0:05, 1:00 / 1:00',
    );
  });
});
