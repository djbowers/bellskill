import { composeStories } from '@storybook/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { features } from '~/config/features';

import * as stories from './PaywallPage.stories';

// Control the launch flag per test (drives notify-me vs real Subscribe).
vi.mock('~/config/features', () => ({ features: { premium: false } }));

const { Trialing, Expired, Free } = composeStories(stories);

describe('paywall page', () => {
  beforeEach(() => {
    localStorage.clear();
    (features as { premium: boolean }).premium = false;
  });

  test('trialing variant shows days remaining', () => {
    render(<Trialing />);
    expect(screen.getByText('12 days left in your trial')).toBeInTheDocument();
  });

  test('expired variant reads as the unlock path', () => {
    render(<Expired />);
    expect(screen.getByText('Your trial has ended')).toBeInTheDocument();
  });

  test('free variant shows the generic unlock pitch', () => {
    render(<Free />);
    expect(screen.getByText('Unlock BellSkill Premium')).toBeInTheDocument();
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
      (features as { premium: boolean }).premium = true;
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
