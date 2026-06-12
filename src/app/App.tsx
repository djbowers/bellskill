import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import { Loading, PWAInstallPrompt, SafeAreaWrapper } from '~/components';
import { EntitlementProvider } from '~/contexts/EntitlementContext';
import { WorkoutOptionsProvider } from '~/contexts/WorkoutOptionsContext';
import { resolveAuthSession } from '~/utils';

import { SessionProvider } from '../contexts';
import { Signup } from '../pages';
import { supabase } from '../supabaseClient';
import '../tailwind.css';
import { routes } from './routes';

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveAuthSession(session).then(setSession);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveAuthSession(session).then(setSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const router = createBrowserRouter(routes);

  return (
    <SafeAreaWrapper>
      {session === undefined && <Loading />}

      {session === null && <Signup />}

      {session && (
        <SessionProvider value={session}>
          <EntitlementProvider>
            <WorkoutOptionsProvider>
              <RouterProvider router={router} />
            </WorkoutOptionsProvider>
          </EntitlementProvider>
        </SessionProvider>
      )}

      <PWAInstallPrompt />
    </SafeAreaWrapper>
  );
}
