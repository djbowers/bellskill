import { describe, expect, test } from 'vitest';

import { formatRungDuration } from './formatRungDuration';

describe('formatRungDuration', () => {
  test('pads seconds to two digits', () => {
    expect(formatRungDuration(30)).toBe('0:30');
    expect(formatRungDuration(5)).toBe('0:05');
  });

  test('rolls over into minutes', () => {
    expect(formatRungDuration(60)).toBe('1:00');
    expect(formatRungDuration(90)).toBe('1:30');
    expect(formatRungDuration(120)).toBe('2:00');
  });

  test('clamps negatives and rounds fractions', () => {
    expect(formatRungDuration(-10)).toBe('0:00');
    expect(formatRungDuration(45.4)).toBe('0:45');
  });
});
