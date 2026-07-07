import { RouteObject } from 'react-router-dom';

import { Features, features } from '../config/features';
import {
  AccountPage,
  ActiveWorkoutPage,
  CheckoutCancelPage,
  CheckoutSuccessPage,
  CompletedWorkoutPage,
  HistoryPage,
  MovementsPage,
  PaywallPage,
  ProgramSessionBuilderPage,
  ProgramsPage,
  RecommendationsPage,
  StartWorkoutPage,
  WeeklyBalancePage,
} from '../pages';
import { Root } from './Root';

/**
 * Builds the route table for a given set of effective feature flags. Pass the
 * session-aware flags from `getFeatures(session)` so feature-gated routes
 * become reachable when an owner enables the preview override.
 */
export const createRoutes = (flags: Features = features): RouteObject[] => [
  {
    path: '/',
    element: <Root />,
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
      ...(flags.weeklyBalance
        ? [{ path: 'balance', element: <WeeklyBalancePage /> }]
        : []),
      ...(flags.explore
        ? [{ path: 'movements', element: <MovementsPage /> }]
        : []),
      ...(flags.premium
        ? [{ path: 'recommendations', element: <RecommendationsPage /> }]
        : []),
      ...(flags.programs
        ? [
            { path: 'programs', element: <ProgramsPage /> },
            {
              path: 'programs/:id/sessions/new',
              element: <ProgramSessionBuilderPage />,
            },
          ]
        : []),
    ],
  },
];

/** Default route table built from the static (no-override) feature flags. */
export const routes: RouteObject[] = createRoutes();
