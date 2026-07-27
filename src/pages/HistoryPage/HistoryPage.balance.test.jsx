import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { useFeatures } from '~/hooks';

import * as stories from './HistoryPage.stories';

// Stub the data-wired panel: this suite exercises HistoryPage's flag/gating
// logic, not the panel's own fetching (covered by WeeklyBalance.test.tsx).
vi.mock('~/components', async (importOriginal) => ({
  ...(await importOriginal()),
  WeeklyBalanceContainer: () => <div>Weekly Balance</div>,
}));

vi.mock('~/hooks', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeatures: vi.fn(),
}));

const { Default } = composeStories(stories);
const mockedUseFeatures = vi.mocked(useFeatures);

const allOff = {
  bottomNav: true,
  complexMode: false,
  explore: false,
  premium: false,
  programs: false,
  weeklyBalance: false,
};

describe('history page weekly balance panel', () => {
  beforeEach(() => {
    mockedUseFeatures.mockReset();
  });

  test('shows the panel alongside history when the flag is on', async () => {
    mockedUseFeatures.mockReturnValue({ ...allOff, weeklyBalance: true });
    render(<Default />);
    await screen.findAllByText('Clean and Press', { exact: false });
    expect(screen.getByText('Weekly Balance')).toBeInTheDocument();
  });

  test('hides the panel when the flag is off', async () => {
    mockedUseFeatures.mockReturnValue(allOff);
    render(<Default />);
    await screen.findAllByText('Clean and Press', { exact: false });
    expect(screen.queryByText('Weekly Balance')).not.toBeInTheDocument();
  });
});
