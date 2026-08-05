import { Features } from '~/config/features';

import { buildTabs } from './buildTabs';

const allOff: Features = {
  explore: false,
  premium: false,
  programs: false,
  spotify: false,
  weeklyBalance: false,
};

const keys = (features: Features) => buildTabs(features).tabs.map((t) => t.key);
const moreKeys = (features: Features) =>
  buildTabs(features).moreFeatures.map((t) => t.key);

describe('buildTabs', () => {
  test('always includes Home and History anchors, in order', () => {
    const { tabs } = buildTabs(allOff);
    expect(tabs.map((t) => t.key)).toEqual(['home', 'history']);
    expect(tabs[0]).toMatchObject({ label: 'Home', to: '/' });
    expect(tabs[1]).toMatchObject({ label: 'History', to: '/history' });
  });

  test('omits the Programs slot when the programs flag is off', () => {
    expect(keys(allOff)).not.toContain('programs');
  });

  test('renders Programs as slot 2 (between Home and History) when enabled', () => {
    const { tabs } = buildTabs({ ...allOff, programs: true });
    expect(tabs.map((t) => t.key)).toEqual(['home', 'programs', 'history']);
    expect(tabs[1]).toMatchObject({ label: 'Programs', to: '/programs' });
  });

  test('no promoted feature when all feature flags are off', () => {
    expect(keys(allOff)).toEqual(['home', 'history']);
    expect(moreKeys(allOff)).toEqual([]);
  });

  test('promotes AI when premium is enabled', () => {
    const tabs = buildTabs({ ...allOff, premium: true }).tabs;
    expect(tabs.map((t) => t.key)).toEqual(['home', 'history', 'ai']);
    expect(tabs[2]).toMatchObject({ label: 'AI', to: '/recommendations' });
  });

  test('promotes Movements when only explore is enabled', () => {
    const { tabs } = buildTabs({ ...allOff, explore: true });
    expect(tabs.map((t) => t.key)).toEqual(['home', 'history', 'explore']);
  });

  test('AI wins the promoted slot over Movements', () => {
    const features = {
      ...allOff,
      premium: true,
      explore: true,
    };
    expect(keys(features)).toEqual(['home', 'history', 'ai']);
    // The non-promoted feature degrades into "More".
    expect(moreKeys(features)).toEqual(['explore']);
  });

  test('bar never exceeds four link tabs (5th slot is the More sheet)', () => {
    const features = {
      ...allOff,
      programs: true,
      premium: true,
      explore: true,
    };
    expect(buildTabs(features).tabs.length).toBeLessThanOrEqual(4);
  });
});
