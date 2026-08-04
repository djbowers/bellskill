import {
  ArrowRightOnRectangleIcon,
  MoonIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { UserCircleIcon as UserCircleSolidIcon } from '@heroicons/react/24/solid';
import { NavLink } from 'react-router-dom';

import { useFeatures } from '~/hooks';
import { handleClickLightDarkMode, handleSignOut } from '~/lib/nav-actions';
import { NavIcon, getNavItems } from '~/lib/navItems';
import { cn } from '~/lib/utils';

const rowClasses =
  'flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

// The shared active affordance: a soft primary-tinted pill. Kept identical to
// the bottom bar's active cell so the two nav surfaces read as one system.
const activeClasses = 'bg-primary/10 text-primary';

/**
 * Desktop-only left navigation rail. Hidden below `lg` (`hidden lg:flex`), where
 * the `BottomNav` thumb bar takes over.
 */
export const Sidebar = () => {
  const features = useFeatures();
  const items = getNavItems(features);

  return (
    <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <div className="px-1.5 py-2">
        <div className="flex items-center gap-1 px-2">
          <img
            src="/favicon.svg"
            alt=""
            className="h-2.5 w-2.5"
            aria-hidden="true"
          />
          <span className="text-lg font-medium">BellSkill</span>
        </div>
      </div>

      <nav aria-label="Primary" className="flex flex-col gap-0.5 px-1.5">
        {items.map((item) => (
          <NavRow
            key={item.key}
            to={item.to}
            label={item.label}
            icon={item.icon}
            activeIcon={item.activeIcon}
            end={item.to === '/'}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 px-1.5 pb-2">
        <NavRow
          to="/account"
          label="Account"
          icon={UserCircleIcon}
          activeIcon={UserCircleSolidIcon}
        />

        <button
          type="button"
          onClick={handleClickLightDarkMode}
          className={cn(rowClasses, 'text-left')}
        >
          <MoonIcon className="h-3 w-3" aria-hidden="true" />
          Light / Dark
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          className={cn(rowClasses, 'text-left')}
        >
          <ArrowRightOnRectangleIcon className="h-3 w-3" aria-hidden="true" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

interface NavRowProps {
  to: string;
  label: string;
  icon: NavIcon;
  activeIcon: NavIcon;
  end?: boolean;
}

const NavRow = ({ to, label, icon: Icon, activeIcon: ActiveIcon, end }: NavRowProps) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) => cn(rowClasses, isActive && activeClasses)}
  >
    {({ isActive }) => (
      <>
        {isActive ? (
          <ActiveIcon className="h-3 w-3" aria-hidden="true" />
        ) : (
          <Icon className="h-3 w-3" aria-hidden="true" />
        )}
        {label}
      </>
    )}
  </NavLink>
);
