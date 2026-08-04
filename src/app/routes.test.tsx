import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import { Features } from '~/config/features';

import { RouteErrorBoundary } from './RouteErrorBoundary';
import { createRoutes } from './routes';

const flagsOff: Features = {
  bottomNav: false,
  explore: false,
  premium: false,
  programs: false,
  spotify: false,
  weeklyBalance: false,
};

const renderAt = (path: string, flags: Features = flagsOff) => {
  const router = createMemoryRouter(createRoutes(flags), {
    initialEntries: [path],
  });
  return render(<RouterProvider router={router} />);
};

describe('createRoutes catch-all', () => {
  it('renders the not-found page for a genuinely unmatched path', () => {
    renderAt('/this-route-does-not-exist');

    expect(screen.getByText('Page not found')).toBeInTheDocument();
    // Never the raw React Router dev fallback.
    expect(screen.queryByText(/Unexpected Application Error/i)).toBeNull();
  });

  it('renders the not-found page for a feature-gated route whose flag is off', () => {
    renderAt('/programs', { ...flagsOff, programs: false });

    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('does not shadow a real matched route', () => {
    // A genuine always-on route still resolves to its own page rather than the
    // catch-all, proving the `*` route sits after the concrete routes.
    renderAt('/checkout/cancel');

    expect(screen.getByText('Checkout canceled')).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).toBeNull();
  });

  it('wires an errorElement on the root route regardless of flags', () => {
    expect(createRoutes(flagsOff)[0].errorElement).toBeTruthy();
    expect(
      createRoutes({ ...flagsOff, programs: true })[0].errorElement,
    ).toBeTruthy();
  });
});

describe('RouteErrorBoundary', () => {
  it('renders a friendly fallback when a route throws', () => {
    // Swallow React Router's expected error-boundary console output.
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const Boom = () => {
      throw new Error('kaboom');
    };
    const router = createMemoryRouter([
      {
        path: '/',
        element: <Boom />,
        errorElement: <RouteErrorBoundary />,
      },
    ]);
    render(<RouterProvider router={router} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    // Never the raw React Router dev fallback.
    expect(screen.queryByText(/Unexpected Application Error/i)).toBeNull();

    consoleError.mockRestore();
  });
});
