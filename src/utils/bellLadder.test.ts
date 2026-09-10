import { nextBell, snapToBell } from './bellLadder';

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
