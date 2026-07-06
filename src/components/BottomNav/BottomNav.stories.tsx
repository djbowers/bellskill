import { Session } from '@supabase/supabase-js';
import { MemoryRouter } from 'react-router-dom';

import { setPreviewOverrideEnabled } from '~/config/features';
import { SessionProvider } from '~/contexts';

import { BottomNav } from './BottomNav';

// The bar reads flags from the session-aware `useFeatures()` hook and is
// desktop-hidden (`sm:hidden`). Use an owner session + the preview override so
// every feature (including `bottomNav`) resolves on, and view it in a mobile
// viewport to see the bar.
const ownerSession = {
  user: { email: 'daniel_bowers@icloud.com' },
} as unknown as Session;

setPreviewOverrideEnabled(true);

export default {
  component: BottomNav,
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  decorators: [
    (Story: () => JSX.Element) => (
      <SessionProvider value={ownerSession}>
        <Story />
      </SessionProvider>
    ),
  ],
};

export const Default = {
  decorators: [
    (Story: () => JSX.Element) => (
      <MemoryRouter initialEntries={['/']}>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export const OnHistory = {
  decorators: [
    (Story: () => JSX.Element) => (
      <MemoryRouter initialEntries={['/history']}>
        <Story />
      </MemoryRouter>
    ),
  ],
};
