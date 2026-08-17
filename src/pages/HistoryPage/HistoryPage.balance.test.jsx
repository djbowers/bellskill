import { composeStories } from '@storybook/react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { useFeatures } from '~/hooks';

import * as stories from './HistoryPage.stories';

// Stub the data-wired panel: this suite exercises HistoryPage's flag/gating
// logic, not the panel's own fetching (covered by TrainingBalance.test.tsx).
vi.mock('~/components', async (importOriginal) => ({
  ...(await importOriginal()),
  TrainingBalanceContainer: () => <div>Balance</div>,
}));

vi.mock('~/hooks', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeatures: vi.fn(),
}));

const { Default } = composeStories(stories);
const mockedUseFeatures = vi.mocked(useFeatures);

const allOff = {
  explore: false,
  modalityBalance: false,
  premium: false,
  programs: false,
  weeklyBalance: false,
};

describe('history page balance panel', () => {
  beforeEach(() => {
    mockedUseFeatures.mockReset();
  });

  test('shows the panel when the pattern flag is on', async () => {
    mockedUseFeatures.mockReturnValue({ ...allOff, weeklyBalance: true });
    render(<Default />);
    await screen.findAllByText('Clean and Press', { exact: false });
    expect(screen.getByText('Balance')).toBeInTheDocument();
  });

  test('shows the panel when only the modality flag is on', async () => {
    mockedUseFeatures.mockReturnValue({ ...allOff, modalityBalance: true });
    render(<Default />);
    await screen.findAllByText('Clean and Press', { exact: false });
    expect(screen.getByText('Balance')).toBeInTheDocument();
  });

  test('hides the panel when both flags are off', async () => {
    mockedUseFeatures.mockReturnValue(allOff);
    render(<Default />);
    await screen.findAllByText('Clean and Press', { exact: false });
    expect(screen.queryByText('Balance')).not.toBeInTheDocument();
  });
});
