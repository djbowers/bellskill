import { composeStories } from '@storybook/react';
import { fireEvent, render, screen } from '@testing-library/react';

import * as stories from './PaywallPage.stories';

const { Trialing, Expired, Free } = composeStories(stories);

describe('paywall page', () => {
  beforeEach(() => {
    localStorage.clear();
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

  test('notify-me CTA records intent and confirms', () => {
    render(<Free />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Notify me when Premium launches' }),
    );
    expect(localStorage.getItem('premium_notify_intent')).toBe('true');
    expect(screen.getByText("We'll let you know — thanks!")).toBeInTheDocument();
  });
});
