import {
  ClockIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  ScaleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { ComponentType, SVGProps } from 'react';

import { Features } from '~/config/features';

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavTab {
  /** Stable identity for React keys and tests. */
  key: string;
  /** Visible label rendered beneath the icon. */
  label: string;
  /** Router destination. */
  to: string;
  icon: NavIcon;
}

/**
 * Feature-gated destinations, in slot-4 promotion priority order. The first
 * enabled feature is promoted into the bar; the rest degrade into "More".
 */
const PRIORITY_FEATURES: {
  key: string;
  flag: keyof Features;
  label: string;
  to: string;
  icon: NavIcon;
}[] = [
  {
    key: 'ai',
    flag: 'premium',
    label: 'AI',
    to: '/recommendations',
    icon: SparklesIcon,
  },
  {
    key: 'balance',
    flag: 'weeklyBalance',
    label: 'Balance',
    to: '/balance',
    icon: ScaleIcon,
  },
  {
    key: 'explore',
    flag: 'explore',
    label: 'Explore',
    to: '/movements',
    icon: MagnifyingGlassIcon,
  },
];

export interface BuiltTabs {
  /** Link tabs rendered directly in the bar, left of the always-present "More". */
  tabs: NavTab[];
  /** Enabled features that did not win the promoted slot; shown inside "More". */
  moreFeatures: NavTab[];
}

const stripFlag = (f: (typeof PRIORITY_FEATURES)[number]): NavTab => ({
  key: f.key,
  label: f.label,
  to: f.to,
  icon: f.icon,
});

/**
 * Deterministic 5-slot priority fill for the bottom tab bar (see the thumb-nav
 * design plan §3). Slots, in order:
 *   1. Home        (always)
 *   2. Programs    (reserved — see TODO below)
 *   3. History     (always)
 *   4. one promoted feature, AI → Balance → Explore (first enabled wins)
 *   5. More        (always; rendered by the component, not part of `tabs`)
 *
 * Pure and side-effect free so every flag combination is cheap to unit-test.
 */
export const buildTabs = (features: Features): BuiltTabs => {
  const tabs: NavTab[] = [
    { key: 'home', label: 'Home', to: '/', icon: HomeIcon },
    // TODO: wire Programs tab when the programs feature lands. It is reserved as
    // slot 2 in the design, but the `programs` flag/route do not exist in the
    // codebase yet, so it is intentionally omitted here to keep this change
    // self-contained and avoid a cross-build dependency.
    { key: 'history', label: 'History', to: '/history', icon: ClockIcon },
  ];

  const enabled = PRIORITY_FEATURES.filter((f) => features[f.flag]);
  const [promoted, ...overflow] = enabled;

  if (promoted) tabs.push(stripFlag(promoted));

  return { tabs, moreFeatures: overflow.map(stripFlag) };
};
