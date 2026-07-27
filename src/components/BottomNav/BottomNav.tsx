import {
  ArrowRightOnRectangleIcon,
  EllipsisHorizontalIcon,
  MoonIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { useFeatures } from '~/hooks';
import { handleClickLightDarkMode, handleSignOut } from '~/lib/nav-actions';
import { cn } from '~/lib/utils';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { buildTabs } from './buildTabs';
import { useBottomNavVisible } from './useBottomNavVisible';

const cellClasses =
  'm-0.5 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-muted-foreground transition-colors active:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

// Shared active affordance — the soft primary-tinted pill, matched to the
// desktop sidebar so both nav surfaces read as one system.
const activeCellClasses = 'bg-primary/10 text-primary';

// Rows inside the "More" sheet; horizontal like the sidebar's rows, so they use
// the same active pill.
const sheetRowClasses =
  'flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground';
const sheetActiveClasses = 'bg-primary/10 text-primary';

/**
 * Fixed bottom "thumb" navigation for mobile viewports. Hidden on desktop
 * (`lg:hidden`) where the `Sidebar` rail takes over. Gated behind the
 * `bottomNav` feature flag, and suppressed on immersive routes and while a text
 * input is focused (mobile keyboard). See the thumb-nav design plan.
 */
export const BottomNav = () => {
  const features = useFeatures();
  const isVisible = useBottomNavVisible();
  const [moreOpen, setMoreOpen] = useState(false);

  // Closed with an explicit handler rather than `DialogClose asChild`: the Slot
  // that `asChild` renders forwards `className` to the DOM node verbatim, so
  // NavLink's function form would land on the anchor as a stringified arrow and
  // the row would render unstyled.
  const closeSheet = () => setMoreOpen(false);

  if (!isVisible) return null;

  const { tabs, moreFeatures } = buildTabs(features);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      <ul className="flex h-6">
        {tabs.map((tab) => {
          const { icon: Icon, activeIcon: ActiveIcon } = tab;
          return (
            <li key={tab.key} className="flex flex-1">
              <NavLink
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  cn(cellClasses, isActive && activeCellClasses)
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive ? (
                      <ActiveIcon className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <Icon className="h-3 w-3" aria-hidden="true" />
                    )}
                    <span className="text-xs">{tab.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}

        <li className="flex flex-1">
          <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
            <DialogTrigger
              className={cn(cellClasses)}
              aria-label="More"
              aria-haspopup="menu"
            >
              <EllipsisHorizontalIcon className="h-3 w-3" aria-hidden="true" />
              <span className="text-xs">More</span>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>More</DialogTitle>
              </DialogHeader>

              <nav aria-label="More navigation" className="flex flex-col">
                <NavLink
                  to="/account"
                  onClick={closeSheet}
                  className={({ isActive }) =>
                    cn(sheetRowClasses, isActive && sheetActiveClasses)
                  }
                >
                  <UserCircleIcon className="h-3 w-3" aria-hidden="true" />
                  Account
                </NavLink>

                {moreFeatures.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <NavLink
                      key={feature.key}
                      to={feature.to}
                      onClick={closeSheet}
                      className={({ isActive }) =>
                        cn(sheetRowClasses, isActive && sheetActiveClasses)
                      }
                    >
                      <Icon className="h-3 w-3" aria-hidden="true" />
                      {feature.label}
                    </NavLink>
                  );
                })}

                <button
                  type="button"
                  onClick={handleClickLightDarkMode}
                  className={cn(sheetRowClasses, 'text-left')}
                >
                  <MoonIcon className="h-3 w-3" aria-hidden="true" />
                  Light / Dark
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className={cn(sheetRowClasses, 'text-left')}
                >
                  <ArrowRightOnRectangleIcon
                    className="h-3 w-3"
                    aria-hidden="true"
                  />
                  Sign Out
                </button>
              </nav>
            </DialogContent>
          </Dialog>
        </li>
      </ul>
    </nav>
  );
};
