import { Outlet } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter6Adapter } from 'use-query-params/adapters/react-router-6';

import { BottomNav, Header } from '~/components';
import { useFeatures } from '~/hooks';

export const Root = () => {
  const features = useFeatures();

  return (
    <QueryParamProvider adapter={ReactRouter6Adapter}>
      <Header />
      {features.bottomNav ? (
        <>
          {/* Offset content so nothing is trapped behind the fixed bar on
              mobile; the bar is desktop-hidden, so remove the padding at `sm`. */}
          <div className="pb-bottomnav sm:pb-0">
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
