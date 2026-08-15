import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Mock, beforeEach, vi } from 'vitest';

import { Features } from '~/config/features';
import { useFeatures } from '~/hooks';

import { BottomNav } from './BottomNav';

vi.mock('~/hooks', () => ({
  useFeatures: vi.fn(),
}));

const mockedUseFeatures = useFeatures as unknown as Mock;

const featuresWith = (overrides: Partial<Features> = {}): Features => ({
  explore: false,
  modalityBalance: false,
  premium: false,
  programs: false,
  spotify: false,
  weeklyBalance: false,
  ...overrides,
});

const renderNav = (initialPath = '/') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
    </MemoryRouter>,
  );

beforeEach(() => {
  mockedUseFeatures.mockReset();
});

describe('BottomNav', () => {
  test('renders Home, History and More by default', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    renderNav();
    expect(
      screen.getByRole('navigation', { name: 'Primary' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  test('promotes the AI tab when premium is enabled', () => {
    mockedUseFeatures.mockReturnValue(featuresWith({ premium: true }));
    renderNav();
    expect(screen.getByRole('link', { name: 'AI' })).toBeInTheDocument();
  });

  test('marks the active route with aria-current', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    renderNav('/history');
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // `end` on Home keeps it inactive on other routes.
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  test('is hidden on the immersive /active route', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    const { container } = renderNav('/active');
    expect(container).toBeEmptyDOMElement();
  });

  test('More sheet exposes Account, theme toggle and Sign Out', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('link', { name: /Account/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Light \/ Dark/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Sign Out/ }),
    ).toBeInTheDocument();
  });

  test('More sheet rows carry their resolved row classes', () => {
    // AI wins the promoted slot, so Movements is the one that overflows.
    mockedUseFeatures.mockReturnValue(
      featuresWith({ premium: true, explore: true }),
    );
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));

    // Regression: routing these through `DialogClose asChild` forwarded
    // NavLink's function className to the anchor as a stringified arrow, so the
    // rows rendered with no styling at all.
    for (const name of [/Account/, /Movements/]) {
      expect(screen.getByRole('link', { name })).toHaveClass(
        'flex',
        'items-center',
      );
    }
  });

  test('navigating from the More sheet closes it', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('link', { name: /Account/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('non-promoted features fall into the More sheet', () => {
    mockedUseFeatures.mockReturnValue(
      featuresWith({ premium: true, explore: true }),
    );
    renderNav();
    // AI is promoted into the bar; Movements overflows into More.
    expect(screen.getByRole('link', { name: 'AI' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('link', { name: /Movements/ })).toBeInTheDocument();
  });

  test('hides while a text input is focused (mobile keyboard)', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    const { container } = render(
      <MemoryRouter>
        <input aria-label="weight" />
        <BottomNav />
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeVisible();

    fireEvent.focusIn(screen.getByLabelText('weight'));
    expect(container.querySelector('nav[aria-label="Primary"]')).toBeNull();
  });
});
