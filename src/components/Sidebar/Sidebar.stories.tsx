import { Session } from '@supabase/supabase-js';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { setPreviewOverrideEnabled } from '~/config/features';
import { SessionProvider } from '~/contexts';

import { Sidebar } from './Sidebar';

// The rail reads flags from the session-aware `useFeatures()` hook and is
// desktop-only (`hidden lg:flex`). Use an owner session + the preview override
// so every destination resolves on, and view it on a wide (>=1024px) canvas.
const ownerSession = {
  user: { email: 'daniel_bowers@icloud.com' },
} as unknown as Session;

setPreviewOverrideEnabled(true);

export default {
  component: Sidebar,
  decorators: [
    (Story: () => React.JSX.Element) => (
      <SessionProvider value={ownerSession}>
        <Story />
      </SessionProvider>
    ),
  ],
};

export const Default = {
  decorators: [
    (Story: () => React.JSX.Element) => (
      <MemoryRouter initialEntries={['/']}>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export const OnHistory = {
  decorators: [
    (Story: () => React.JSX.Element) => (
      <MemoryRouter initialEntries={['/history']}>
        <Story />
      </MemoryRouter>
    ),
  ],
};
