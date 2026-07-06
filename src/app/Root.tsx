import { Outlet } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';

import { BottomNav, Header, useBottomNavVisible } from '~/components';
import { useFeatures } from '~/hooks';

export const Root = () => {
  const features = useFeatures();
  const bottomNavVisible = useBottomNavVisible();

  return (
    <QueryParamProvider adapter={ReactRouter6Adapter}>
      <Header />
      {features.bottomNav ? (
        <>
          {/* Offset content so nothing is trapped behind the fixed bar on
              mobile; the bar is desktop-hidden, so remove the padding at `sm`.
              Only pad while the bar is actually on screen so immersive routes
              and the open-keyboard state have no dead space. */}
          <div className={bottomNavVisible ? 'pb-bottomnav sm:pb-0' : undefined}>
            <Outlet />
          </div>
          <BottomNav />
        </>
      ) : (
        <Outlet />
      )}
    </QueryParamProvider>
  );
};
