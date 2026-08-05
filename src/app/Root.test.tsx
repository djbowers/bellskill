import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { Mock, beforeEach, vi } from 'vitest';

import { Features } from '~/config/features';
import { useFeatures } from '~/hooks';

import { Root } from './Root';

vi.mock('~/hooks', () => ({
  useFeatures: vi.fn(),
}));

const mockedUseFeatures = useFeatures as unknown as Mock;

const featuresWith = (overrides: Partial<Features> = {}): Features => ({
  explore: false,
  premium: false,
  programs: false,
  spotify: false,
  weeklyBalance: false,
  ...overrides,
});

const renderRoot = (initialPath = '/') => {
  const router = createMemoryRouter(
    [{ path: '/', element: <Root />, children: [{ path: '*', element: null }] }],
    { initialEntries: [initialPath] },
  );
  return render(<RouterProvider router={router} />);
};

beforeEach(() => {
  mockedUseFeatures.mockReset();
});

describe('Root', () => {
  test('renders the Sidebar + BottomNav shell', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    renderRoot();

    // Both surfaces mount and are shown/hidden by breakpoint, not by branch, so
    // the shell owns navigation on every viewport.
    expect(screen.getAllByRole('navigation', { name: 'Primary' })).toHaveLength(
      2,
    );
  });

  test('never renders a top header', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    renderRoot();

    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'BellSkill' })).toBeNull();
  });
});
