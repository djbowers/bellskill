import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Mock, beforeEach, vi } from 'vitest';

import { Features } from '~/config/features';
import { useFeatures } from '~/hooks';

import { Sidebar } from './Sidebar';

vi.mock('~/hooks', () => ({
  useFeatures: vi.fn(),
}));

const mockedUseFeatures = useFeatures as unknown as Mock;

const featuresWith = (overrides: Partial<Features> = {}): Features => ({
  bottomNav: true,
  complexMode: false,
  explore: false,
  premium: false,
  programs: false,
  spotify: false,
  weeklyBalance: false,
  ...overrides,
});

const renderSidebar = (initialPath = '/') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Sidebar />
    </MemoryRouter>,
  );

beforeEach(() => {
  mockedUseFeatures.mockReset();
});

describe('Sidebar', () => {
  test('renders the brand and the always-on destinations', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    renderSidebar();
    expect(
      screen.getByRole('navigation', { name: 'Primary' }),
    ).toBeInTheDocument();
    expect(screen.getByText('BellSkill')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();
  });

  test('reveals flag-gated destinations only when enabled', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    renderSidebar();
    expect(screen.queryByRole('link', { name: 'Programs' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'AI' })).toBeNull();

    mockedUseFeatures.mockReturnValue(
      featuresWith({ programs: true, premium: true }),
    );
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Programs' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI' })).toBeInTheDocument();
  });

  test('exposes the Account link, theme toggle and Sign Out', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    renderSidebar();
    expect(screen.getByRole('link', { name: /Account/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Light \/ Dark/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Sign Out/ }),
    ).toBeInTheDocument();
  });

  test('marks the active destination with aria-current', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    renderSidebar('/history');
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // `end` on Home keeps it inactive on other routes.
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
