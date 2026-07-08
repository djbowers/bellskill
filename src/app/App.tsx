import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import { Loading, PWAInstallPrompt, SafeAreaWrapper } from '~/components';
import { EntitlementProvider } from '~/contexts/EntitlementContext';
import { ProgramSessionProvider } from '~/contexts/ProgramSessionContext';
import { ToastProvider } from '~/contexts/ToastContext';
import { WorkoutOptionsProvider } from '~/contexts/WorkoutOptionsContext';
import { resolveAuthSession } from '~/utils';

import { getFeatures } from '../config/features';
import { SessionProvider } from '../contexts';
import { Signup } from '../pages';
import { supabase } from '../supabaseClient';
import '../tailwind.css';
import { createRoutes } from './routes';

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

  // Build routes from the session-aware feature flags so that feature-gated
  // routes become reachable when an owner enables the preview override.
  const router = createBrowserRouter(createRoutes(getFeatures(session)));

  return (
    <SafeAreaWrapper>
      {session === undefined && <Loading />}

      {session === null && <Signup />}

      {session && (
        <SessionProvider value={session}>
          <EntitlementProvider>
            <WorkoutOptionsProvider>
              <ProgramSessionProvider>
                <ToastProvider>
                  <RouterProvider router={router} />
                </ToastProvider>
              </ProgramSessionProvider>
            </WorkoutOptionsProvider>
          </EntitlementProvider>
        </SessionProvider>
      )}

      <PWAInstallPrompt />
    </SafeAreaWrapper>
  );
}
