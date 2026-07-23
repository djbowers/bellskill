import { describe, expect, it } from 'vitest';

import { getBellColor } from './bellColors';

describe('getBellColor', () => {
  it('gives the two names of one bell the same color', () => {
    expect(getBellColor(24, 'kilograms')).toBe(getBellColor(53, 'pounds'));
    expect(getBellColor(16, 'kilograms')).toBe(getBellColor(35, 'pounds'));
  });

  it('returns null for sizes outside the competition standard', () => {
    expect(getBellColor(25, 'kilograms')).toBeNull();
    expect(getBellColor(54, 'pounds')).toBeNull();
  });

  it('does not color a pound value using the kilogram table', () => {
    expect(getBellColor(24, 'pounds')).toBeNull();
  });

  it('returns null when the unit is unknown', () => {
    expect(getBellColor(24, null)).toBeNull();
  });
});
