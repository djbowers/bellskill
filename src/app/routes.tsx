import { RouteObject } from 'react-router-dom';

import { features } from '../config/features';
import {
  AccountPage,
  ActiveWorkoutPage,
  CheckoutCancelPage,
  CheckoutSuccessPage,
  CompletedWorkoutPage,
  HistoryPage,
  MovementsPage,
  PaywallPage,
  RecommendationsPage,
  StartWorkoutPage,
  WeeklyBalancePage,
} from '../pages';
import { Root } from './Root';

export const routes: RouteObject[] = [
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
      {
        path: 'balance',
        element: <WeeklyBalancePage />,
      },
      ...(features.explore ? [{ path: 'movements', element: <MovementsPage /> }] : []),
      ...(features.premium
        ? [{ path: 'recommendations', element: <RecommendationsPage /> }]
        : []),
    ],
  },
];
