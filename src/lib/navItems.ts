import {
  ClockIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  RectangleStackIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import {
  ClockIcon as ClockSolidIcon,
  HomeIcon as HomeSolidIcon,
  MagnifyingGlassIcon as MagnifyingGlassSolidIcon,
  RectangleStackIcon as RectangleStackSolidIcon,
  SparklesIcon as SparklesSolidIcon,
} from '@heroicons/react/24/solid';
import { ComponentType, SVGProps } from 'react';

import { Features } from '~/config/features';

export type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavItem {
  /** Stable identity for React keys and tests. */
  key: string;
  /** Visible label. */
  label: string;
  /** Router destination. */
  to: string;
  /** Outline icon, shown when the destination is inactive. */
  icon: NavIcon;
  /** Solid icon, shown when the destination is active. */
  activeIcon: NavIcon;
  /** Feature flag gating this destination; omit for always-on anchors. */
  flag?: keyof Features;
}

/**
 * The full set of primary destinations, in sidebar display order — the single
 * source of truth shared by the desktop `Sidebar` and the mobile `BottomNav`
 * (via `buildTabs`). The bottom bar reorders and overflows this list into its
 * 5-slot layout; the sidebar renders it as-is.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    key: 'home',
    label: 'Home',
    to: '/',
    icon: HomeIcon,
    activeIcon: HomeSolidIcon,
  },
  {
    key: 'programs',
    label: 'Programs',
    to: '/programs',
    icon: RectangleStackIcon,
    activeIcon: RectangleStackSolidIcon,
    flag: 'programs',
  },
  {
    key: 'explore',
    label: 'Movements',
    to: '/movements',
    icon: MagnifyingGlassIcon,
    activeIcon: MagnifyingGlassSolidIcon,
    flag: 'explore',
  },
  {
    key: 'ai',
    label: 'Chalk',
    to: '/chalk',
    icon: SparklesIcon,
    activeIcon: SparklesSolidIcon,
    flag: 'premium',
  },
  {
    key: 'history',
    label: 'History',
    to: '/history',
    icon: ClockIcon,
    activeIcon: ClockSolidIcon,
  },
];

/** Destinations visible for the given flags, in sidebar order. */
export const getNavItems = (features: Features): NavItem[] =>
  NAV_ITEMS.filter((item) => !item.flag || features[item.flag]);

/** Look up a destination by key (throws on unknown key — a programming error). */
export const navItemByKey = (key: string): NavItem => {
  const item = NAV_ITEMS.find((i) => i.key === key);
  if (!item) throw new Error(`Unknown nav item: ${key}`);
  return item;
};
