import { Features } from '~/config/features';
import { NavItem, navItemByKey } from '~/lib/navItems';

// Promoted-slot priority (slot 4): the first enabled feature wins the bar; the
// rest degrade into "More". See §3 of the thumb-nav design plan.
const PRIORITY_KEYS = ['ai', 'balance', 'explore'] as const;

export interface BuiltTabs {
  /** Link tabs rendered directly in the bar, left of the always-present "More". */
  tabs: NavItem[];
  /** Enabled features that did not win the promoted slot; shown inside "More". */
  moreFeatures: NavItem[];
}

/**
 * Deterministic 5-slot priority fill for the bottom tab bar, built from the
 * shared `NAV_ITEMS` registry (see `~/lib/navItems`). Slots, in order:
 *   1. Home        (always)
 *   2. Programs    (reserved; `programs` flag)
 *   3. History     (always)
 *   4. one promoted feature, AI → Balance → Explore (first enabled wins)
 *   5. More        (always; rendered by the component, not part of `tabs`)
 *
 * Pure and side-effect free so every flag combination is cheap to unit-test.
 */
export const buildTabs = (features: Features): BuiltTabs => {
  const tabs: NavItem[] = [
    navItemByKey('home'),
    ...(features.programs ? [navItemByKey('programs')] : []),
    navItemByKey('history'),
  ];

  const enabled = PRIORITY_KEYS.map(navItemByKey).filter(
    (item) => item.flag && features[item.flag],
  );
  const [promoted, ...overflow] = enabled;

  if (promoted) tabs.push(promoted);

  return { tabs, moreFeatures: overflow };
};
