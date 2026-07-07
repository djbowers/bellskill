import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';

import { BottomNav, Header, useBottomNavVisible } from '~/components';
import { useFeatures } from '~/hooks';

// Rendered only when the `bottomNav` flag is on so the keyboard subscription in
// `useBottomNavVisible` never mounts for flag-off sessions, and its focus/blur
// re-renders stay scoped to the bar and this wrapper instead of all of `Root`.
const BottomNavLayout = ({ children }: { children: ReactNode }) => {
  const bottomNavVisible = useBottomNavVisible();

  return (
    <>
      {/* Offset content so nothing is trapped behind the fixed bar on mobile;
          the bar is desktop-hidden, so remove the padding at `sm`. Only pad
          while the bar is actually on screen so immersive routes and the
          open-keyboard state have no dead space. */}
      <div className={bottomNavVisible ? 'pb-bottomnav sm:pb-0' : undefined}>
        {children}
      </div>
      <BottomNav />
    </>
  );
};

export const Root = () => {
  const features = useFeatures();

  return (
    <QueryParamProvider adapter={ReactRouter6Adapter}>
      <Header />
      {features.bottomNav ? (
        <BottomNavLayout>
          <Outlet />
        </BottomNavLayout>
      ) : (
        <Outlet />
      )}
    </QueryParamProvider>
  );
};
