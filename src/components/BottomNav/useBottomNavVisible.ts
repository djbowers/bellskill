import { useLocation } from 'react-router-dom';

import { useFeatures } from '~/hooks';

import { useIsKeyboardOpen } from './useIsKeyboardOpen';

// Routes that hide the bar entirely for an immersive, focused experience.
export const SUPPRESSED_ROUTES = ['/active'];

/**
 * Single source of truth for whether the fixed bottom "thumb" bar is actually
 * on screen. True only when the `bottomNav` flag is on, the current route is not
 * immersive, and the mobile keyboard is closed. Both the bar itself and the
 * content offset in `Root` consume this so the padding never outlives the bar.
 */
export const useBottomNavVisible = (): boolean => {
  const features = useFeatures();
  const { pathname } = useLocation();
  const isKeyboardOpen = useIsKeyboardOpen();

  if (!features.bottomNav) return false;
  if (SUPPRESSED_ROUTES.includes(pathname)) return false;
  if (isKeyboardOpen) return false;

  return true;
};
