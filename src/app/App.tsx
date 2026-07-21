import { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import { LoadingScreen, PWAInstallPrompt, SafeAreaWrapper } from '~/components';
import { EntitlementProvider } from '~/contexts/EntitlementContext';
import { ProgramSessionProvider } from '~/contexts/ProgramSessionContext';
import { ToastProvider } from '~/contexts/ToastContext';
import { WorkoutOptionsProvider } from '~/contexts/WorkoutOptionsContext';
import { resolveAuthSession } from '~/utils';

import { getFeatures, isDeployPreview } from '../config/features';
import { SessionProvider } from '../contexts';
import {
  VITE_PREVIEW_USER_EMAIL,
  VITE_PREVIEW_USER_PASSWORD,
} from '../env';
import { Signup } from '../pages';
import { supabase } from '../supabaseClient';
import '../tailwind.css';
import { FeatureFlagsGate } from './FeatureFlagsGate';
import { createRoutes } from './routes';

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // Deploy previews auto-sign-in as the seeded staging test user so a PR
    // preview is usable with no email/OTP. Gated on the preview build flag —
    // inert in production and local builds (see netlify.toml / features.ts).
    const previewAutoLogin =
      isDeployPreview() &&
      !!VITE_PREVIEW_USER_EMAIL &&
      !!VITE_PREVIEW_USER_PASSWORD;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && previewAutoLogin) {
        // Keep the Loading splash up while sign-in is in flight; success
        // arrives via onAuthStateChange (SIGNED_IN). Only surface a failure.
        supabase.auth
          .signInWithPassword({
            email: VITE_PREVIEW_USER_EMAIL,
            password: VITE_PREVIEW_USER_PASSWORD,
          })
          .then(({ error }) => {
            if (error) setSession(null);
          });
        return;
      }
      resolveAuthSession(session).then(setSession);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // On a preview, ignore the transient null (INITIAL_SESSION / pre-login)
      // so the Signup screen doesn't flash before auto-login resolves — a real
      // sign-in failure is surfaced by the error handler above instead.
      if (previewAutoLogin && !session) return;
      resolveAuthSession(session).then(setSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Build routes from the session-aware feature flags so that feature-gated
  // routes become reachable when an owner enables the preview override.
  const router = createBrowserRouter(createRoutes(getFeatures(session)));

  return (
    <SafeAreaWrapper>
      {session === undefined && <LoadingScreen />}

      {session === null && <Signup />}

      {session && (
        <SessionProvider value={session}>
          <EntitlementProvider>
            <WorkoutOptionsProvider>
              <ProgramSessionProvider>
                <ToastProvider>
                  <FeatureFlagsGate>
                    <RouterProvider router={router} />
                  </FeatureFlagsGate>
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
