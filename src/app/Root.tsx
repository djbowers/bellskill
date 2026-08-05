import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';

import { BottomNav, Sidebar, useBottomNavVisible } from '~/components';

// Keeps the keyboard subscription in `useBottomNavVisible` — and the focus/blur
// re-renders it triggers — scoped to the nav chrome and this wrapper instead of
// all of `Root`. Lays out the two coordinated nav surfaces: the desktop
// `Sidebar` rail (`lg` and up) and the mobile `BottomNav` thumb bar (below `lg`).
const NavLayout = ({ children }: { children: ReactNode }) => {
  const bottomNavVisible = useBottomNavVisible();

  return (
    <div className="lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        {/* Offset content so nothing is trapped behind the fixed bar on mobile;
            the bar is hidden at `lg`, so drop the padding there. Only pad while
            the bar is actually on screen so immersive routes and the
            open-keyboard state have no dead space. */}
        <div className={bottomNavVisible ? 'pb-bottomnav lg:pb-0' : undefined}>
          {children}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export const Root = () => (
  <QueryParamProvider adapter={ReactRouter6Adapter}>
    <NavLayout>
      <Outlet />
    </NavLayout>
  </QueryParamProvider>
);
