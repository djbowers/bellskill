import { act, renderHook, screen } from '@testing-library/react';
import { fireEvent, render } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { useBottomNavVisible } from './useBottomNavVisible';

const wrapperFor =
  (initialPath = '/') =>
  ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
  );

describe('useBottomNavVisible', () => {
  test('is visible when the route is not suppressed', () => {
    const { result } = renderHook(() => useBottomNavVisible(), {
      wrapper: wrapperFor('/'),
    });
    expect(result.current).toBe(true);
  });

  test('is hidden on the immersive /active route', () => {
    const { result } = renderHook(() => useBottomNavVisible(), {
      wrapper: wrapperFor('/active'),
    });
    expect(result.current).toBe(false);
  });

  test('is hidden while a text input is focused (mobile keyboard)', () => {
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
