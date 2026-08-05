import { RouteObject } from 'react-router-dom';

import { Features, features } from '../config/features';
import {
  AccountPage,
  ActiveWorkoutPage,
  CheckoutCancelPage,
  CheckoutSuccessPage,
  CompletedWorkoutPage,
  EquipmentPage,
  HistoryPage,
  MovementDetailsPage,
  MovementsPage,
  NotFoundPage,
  PaywallPage,
  ProgramDetailsPage,
  ProgramProgressPage,
  ProgramSessionBuilderPage,
  ProgramsPage,
  RecommendationsPage,
  SpotifyCallbackPage,
  StartWorkoutPage,
} from '../pages';
import { Root } from './Root';
import { RouteErrorBoundary } from './RouteErrorBoundary';

/**
 * Builds the route table for a given set of effective feature flags. Pass the
 * session-aware flags from `getFeatures(session)` so feature-gated routes
 * become reachable when an owner enables the preview override.
 */
export const createRoutes = (flags: Features = features): RouteObject[] => [
  {
    path: '/',
    element: <Root />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '',
        element: <StartWorkoutPage />,
      },
      {
        path: 'active',
        element: <ActiveWorkoutPage />,
      },
      {
        path: 'account',
        element: <AccountPage />,
      },
      {
        path: 'account/equipment',
        element: <EquipmentPage />,
      },
      {
        path: 'history',
        element: <HistoryPage />,
      },
      {
        path: 'history/:id',
        element: <CompletedWorkoutPage />,
      },
      {
        path: 'paywall',
        element: <PaywallPage />,
      },
      {
        path: 'checkout/success',
        element: <CheckoutSuccessPage />,
      },
      {
        path: 'checkout/cancel',
        element: <CheckoutCancelPage />,
      },
      ...(flags.spotify
        ? [{ path: 'spotify/callback', element: <SpotifyCallbackPage /> }]
        : []),
      ...(flags.explore
        ? [
            { path: 'movements', element: <MovementsPage /> },
            { path: 'movements/:id', element: <MovementDetailsPage /> },
          ]
        : []),
      ...(flags.premium
        ? [{ path: 'recommendations', element: <RecommendationsPage /> }]
        : []),
      ...(flags.programs
        ? [
            { path: 'programs', element: <ProgramsPage /> },
            { path: 'programs/:id', element: <ProgramProgressPage /> },
            {
              path: 'programs/:id/details',
              element: <ProgramDetailsPage />,
            },
            {
              path: 'programs/:id/sessions/new',
              element: <ProgramSessionBuilderPage />,
            },
            {
              path: 'programs/:id/sessions/:sessionId/edit',
              element: <ProgramSessionBuilderPage />,
            },
          ]
        : []),
      // Catch-all for any unmatched path — including feature-gated routes whose
      // flag is off (e.g. `/programs` when `programs` is disabled). Kept outside
      // every `flags.*` spread so it is always present regardless of flags.
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
];

/** Default route table built from the static (no-override) feature flags. */
export const routes: RouteObject[] = createRoutes();
