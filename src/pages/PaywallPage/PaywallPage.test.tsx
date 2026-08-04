import { composeStories } from '@storybook/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { Features } from '~/config/features';

import * as stories from './PaywallPage.stories';

// Control the flags per test (premium drives notify-me vs real Subscribe;
// weeklyBalance drives the free-forever list) by mocking the
// effective-features hook the page reads.
const { mockUseFeatures } = vi.hoisted(() => ({ mockUseFeatures: vi.fn() }));
vi.mock('~/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/hooks')>()),
  useFeatures: mockUseFeatures,
}));

const setFeatures = (overrides: Partial<Features> = {}) =>
  mockUseFeatures.mockReturnValue({
    explore: false,
    premium: false,
    programs: false,
    spotify: false,
    weeklyBalance: false,
    ...overrides,
  });

const { Trialing, Expired, Free } = composeStories(stories);

describe('paywall page', () => {
  beforeEach(() => {
    localStorage.clear();
    setFeatures();
  });

  test('trialing variant shows days remaining', () => {
    render(<Trialing />);
    expect(screen.getByText('12 days left in your trial')).toBeInTheDocument();
  });

  test('expired variant reads as the unlock path', () => {
    render(<Expired />);
    expect(screen.getByText('Your trial has ended')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your workout logging and history are still here. Premium brings back the intelligence layer.',
      ),
    ).toBeInTheDocument();
  });

  test('free variant shows the generic unlock pitch', () => {
    render(<Free />);
    expect(screen.getByText('Unlock BellSkill Premium')).toBeInTheDocument();
  });

  test('free-forever list only names shipped features', () => {
    render(<Free />);
    expect(
      screen.getByText('Free forever: Workout logging, Workout history.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/skill tree/i)).not.toBeInTheDocument();
  });

  test('free-forever list includes weekly balance when flag-enabled', () => {
    setFeatures({ weeklyBalance: true });
    render(<Free />);
    expect(
      screen.getByText(
        'Free forever: Workout logging, Workout history, Weekly pattern balance.',
      ),
    ).toBeInTheDocument();
  });

  test('unshipped Tetris programming is framed as upcoming', () => {
    render(<Free />);
    expect(
      screen.getByText('Weekly Tetris programming — coming soon'),
    ).toBeInTheDocument();
  });

  describe('premium flag OFF (pre-launch)', () => {
    test('notify-me CTA records intent and confirms', () => {
      render(<Free />);
      fireEvent.click(
        screen.getByRole('button', { name: 'Notify me when Premium launches' }),
      );
      expect(localStorage.getItem('premium_notify_intent')).toBe('true');
      expect(
        screen.getByText("We'll let you know — thanks!"),
      ).toBeInTheDocument();
    });
  });

  describe('premium flag ON (launched)', () => {
    beforeEach(() => {
      setFeatures({ premium: true });
    });

    test('shows real Subscribe CTA, not notify-me', () => {
      render(<Free />);
      expect(
        screen.getByRole('button', { name: /Subscribe/ }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Notify me when Premium launches'),
      ).not.toBeInTheDocument();
    });

    test('Subscribe label reflects the selected plan (yearly default → monthly)', () => {
      render(<Free />);
      // Yearly is preselected.
      expect(
        screen.getByRole('button', { name: 'Subscribe — $79/yr' }),
      ).toBeInTheDocument();
      // Select monthly.
      fireEvent.click(screen.getByRole('button', { name: /Monthly/ }));
      expect(
        screen.getByRole('button', { name: 'Subscribe — $9.99/mo' }),
      ).toBeInTheDocument();
    });
  });
});
