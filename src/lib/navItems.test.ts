import { Features } from '~/config/features';

import { getNavItems, navItemByKey } from './navItems';

const allOff: Features = {
  bottomNav: true,
  explore: false,
  premium: false,
  programs: false,
  spotify: false,
  weeklyBalance: false,
};

const keys = (features: Features) => getNavItems(features).map((i) => i.key);

describe('getNavItems', () => {
  test('always includes the Home and History anchors, in order', () => {
    expect(keys(allOff)).toEqual(['home', 'history']);
  });

  test('reveals each destination only when its flag is on', () => {
    expect(keys({ ...allOff, programs: true })).toEqual([
      'home',
      'programs',
      'history',
    ]);
    expect(keys({ ...allOff, explore: true })).toEqual([
      'home',
      'explore',
      'history',
    ]);
    expect(keys({ ...allOff, premium: true })).toEqual([
      'home',
      'ai',
      'history',
    ]);
  });

  test('keeps sidebar display order with every flag on', () => {
    const allOn: Features = {
      ...allOff,
      programs: true,
      explore: true,
      premium: true,
      weeklyBalance: true,
    };
    expect(keys(allOn)).toEqual([
      'home',
      'programs',
      'explore',
      'ai',
      'history',
    ]);
  });

  test('carries both an outline and a solid icon for each destination', () => {
    for (const item of getNavItems(allOff)) {
      expect(item.icon).toBeTruthy();
      expect(item.activeIcon).toBeTruthy();
    }
  });
});

describe('navItemByKey', () => {
  test('resolves a known destination', () => {
    expect(navItemByKey('ai')).toMatchObject({
      label: 'AI',
      to: '/recommendations',
    });
  });

  test('throws on an unknown key', () => {
    expect(() => navItemByKey('nope')).toThrow(/Unknown nav item/);
  });
});
