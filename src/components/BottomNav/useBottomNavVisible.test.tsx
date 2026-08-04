import { act, renderHook, screen } from '@testing-library/react';
import { fireEvent, render } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Mock, beforeEach, vi } from 'vitest';

import { Features } from '~/config/features';
import { useFeatures } from '~/hooks';

import { useBottomNavVisible } from './useBottomNavVisible';

vi.mock('~/hooks', () => ({
  useFeatures: vi.fn(),
}));

const mockedUseFeatures = useFeatures as unknown as Mock;

const featuresWith = (overrides: Partial<Features> = {}): Features => ({
  bottomNav: true,
  explore: false,
  premium: false,
  programs: false,
  spotify: false,
  weeklyBalance: false,
  ...overrides,
});

const wrapperFor =
  (initialPath = '/') =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
  );

beforeEach(() => {
  mockedUseFeatures.mockReset();
});

describe('useBottomNavVisible', () => {
  test('is visible when the flag is on and the route is not suppressed', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    const { result } = renderHook(() => useBottomNavVisible(), {
      wrapper: wrapperFor('/'),
    });
    expect(result.current).toBe(true);
  });

  test('is hidden when the bottomNav flag is off', () => {
    mockedUseFeatures.mockReturnValue(featuresWith({ bottomNav: false }));
    const { result } = renderHook(() => useBottomNavVisible(), {
      wrapper: wrapperFor('/'),
    });
    expect(result.current).toBe(false);
  });

  test('is hidden on the immersive /active route', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    const { result } = renderHook(() => useBottomNavVisible(), {
      wrapper: wrapperFor('/active'),
    });
    expect(result.current).toBe(false);
  });

  test('is hidden while a text input is focused (mobile keyboard)', () => {
    mockedUseFeatures.mockReturnValue(featuresWith());
    const Probe = () => (
      <span data-testid="state">{String(useBottomNavVisible())}</span>
    );
    render(
      <MemoryRouter>
        <input aria-label="weight" />
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('state')).toHaveTextContent('true');

    act(() => {
      fireEvent.focusIn(screen.getByLabelText('weight'));
    });
    expect(screen.getByTestId('state')).toHaveTextContent('false');
  });
});
