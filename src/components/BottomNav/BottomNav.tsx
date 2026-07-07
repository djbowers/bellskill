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
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { buildTabs } from './buildTabs';
import { useBottomNavVisible } from './useBottomNavVisible';

const cellClasses =
  'flex flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors active:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

/**
 * Fixed bottom "thumb" navigation for mobile viewports. Hidden on desktop
 * (`sm:hidden`) where the top Header remains the nav. Gated behind the
 * `bottomNav` feature flag, and suppressed on immersive routes and while a text
 * input is focused (mobile keyboard). See the thumb-nav design plan.
 */
export const BottomNav = () => {
  const features = useFeatures();
  const isVisible = useBottomNavVisible();
  const [moreOpen, setMoreOpen] = useState(false);

  if (!isVisible) return null;

  const { tabs, moreFeatures } = buildTabs(features);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      <ul className="flex h-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <li key={tab.key} className="flex flex-1">
              <NavLink
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  cn(cellClasses, isActive && 'text-primary')
                }
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                <span className="text-xs">{tab.label}</span>
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
                <DialogClose asChild>
                  <NavLink
                    to="/account"
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                        isActive && 'bg-accent text-accent-foreground',
                      )
                    }
                  >
                    <UserCircleIcon className="h-3 w-3" aria-hidden="true" />
                    Account
                  </NavLink>
                </DialogClose>

                {moreFeatures.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <DialogClose asChild key={feature.key}>
                      <NavLink
                        to={feature.to}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                            isActive && 'bg-accent text-accent-foreground',
                          )
                        }
                      >
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {feature.label}
                      </NavLink>
                    </DialogClose>
                  );
                })}

                <button
                  type="button"
                  onClick={handleClickLightDarkMode}
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <MoonIcon className="h-3 w-3" aria-hidden="true" />
                  Light / Dark
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
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
