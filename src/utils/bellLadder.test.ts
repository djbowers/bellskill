import { nextBell, snapToBell } from './bellLadder';
import { bellFromWeight } from './skillNodeLoadEdge';

describe('snapToBell', () => {
  test('an exact bell is its own rung', () => {
    expect(snapToBell(24)).toBe(24);
    expect(snapToBell(48)).toBe(48);
  });

  test('a load between rungs snaps down', () => {
    expect(snapToBell(26)).toBe(24);
    expect(snapToBell(47.5)).toBe(40);
  });

  test('anything under the lightest bell has no rung', () => {
    expect(snapToBell(7.5)).toBeNull();
    expect(snapToBell(0)).toBeNull();
  });
});

describe('nextBell', () => {
  test('returns the rung above the current load', () => {
    expect(nextBell(24)).toBe(28);
    expect(nextBell(null)).toBe(8);
  });

  test('returns null at the top of the ladder', () => {
    expect(nextBell(48)).toBeNull();
  });
});

describe('bellFromWeight', () => {
  test('reads kilogram loads straight off the ladder', () => {
    expect(bellFromWeight(24, 'kilograms')).toBe(24);
  });

  test('rounds pound bells onto the rung they were cast as', () => {
    expect(bellFromWeight(35, 'pounds')).toBe(16);
    expect(bellFromWeight(53, 'pounds')).toBe(24);
    expect(bellFromWeight(70, 'pounds')).toBe(32);
    expect(bellFromWeight(88, 'pounds')).toBe(40);
  });

  test('treats the one-hand sentinel and bodyweight as no bell', () => {
    expect(bellFromWeight(0, 'kilograms')).toBeNull();
    expect(bellFromWeight(null, null)).toBeNull();
  });
});
