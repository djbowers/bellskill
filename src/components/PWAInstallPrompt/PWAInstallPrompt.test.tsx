import { composeStories } from '@storybook/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as stories from './PWAInstallPrompt.stories';

const { Default } = composeStories(stories);

const mockBeforeInstallPrompt = () => {
  const event = new Event('beforeinstallprompt') as any;
  event.platforms = ['web'];
  event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
  event.prompt = vi.fn(() => Promise.resolve());
  return event;
};

const mockLocalStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(() => {}),
};

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  });
};

const mockUserAgent = (userAgent: string) => {
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  });
};

const mockStandalone = (standalone: boolean) => {
  Object.defineProperty(navigator, 'standalone', {
    value: standalone,
    configurable: true,
  });
};

const mockReferrer = (referrer: string) => {
  Object.defineProperty(document, 'referrer', {
    value: referrer,
    configurable: true,
  });
};

const setupMocks = () => {
  vi.clearAllMocks();

  mockMatchMedia(false);
  mockUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  );
  mockStandalone(false);
  mockReferrer('https://example.com');

  Object.defineProperty(window, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });
};

describe('PWAInstallPrompt', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    window.removeEventListener('beforeinstallprompt', vi.fn());
  });

  describe('Rendering', () => {
    it('should render the install prompt on mobile devices', async () => {
      render(<Default />);

      await waitFor(() => {
        expect(screen.getByText('Install BellSkill')).toBeTruthy();
        expect(screen.getByText(/Tap the.*share button below/)).toBeTruthy();
      });
    });

    it('should not render when app is already installed (standalone mode)', () => {
      setupMocks();
      mockMatchMedia(true);
      mockStandalone(true);

      render(<Default />);

      expect(screen.queryByText('Install BellSkill')).toBeNull();
    });

    it('should not render on desktop browsers', () => {
      setupMocks();
      mockUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      );

      render(<Default />);

      expect(screen.queryByText('Install BellSkill')).toBeNull();
    });

    it('should not render when recently dismissed', () => {
      setupMocks();
      const recentlyDismissedStorage = {
        getItem: vi.fn((key: string) => {
          if (key === 'pwa-install-dismissed') {
            return (Date.now() - 1000 * 60 * 60 * 24 * 2).toString(); // 2 days ago
          }
          return null;
        }),
        setItem: vi.fn(() => {}),
      };

      Object.defineProperty(window, 'localStorage', {
        value: recentlyDismissedStorage,
        writable: true,
      });

      render(<Default />);

      expect(screen.queryByText('Install BellSkill')).toBeNull();
    });
  });

  describe('User Interactions', () => {
    it('should dismiss the prompt when X button is clicked', async () => {
      render(<Default />);

      await waitFor(() => {
        expect(screen.getByText('Install BellSkill')).toBeTruthy();
      });

      // Override after render, before interaction
      const testLocalStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {}),
      };
      Object.defineProperty(window, 'localStorage', {
        value: testLocalStorage,
        writable: true,
      });

      const dismissButton = screen.getByLabelText('Dismiss');
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByText('Install BellSkill')).toBeNull();
      });

      expect(testLocalStorage.setItem).toHaveBeenCalledWith(
        'pwa-install-dismissed',
        expect.any(String),
      );
    });

    it('should handle beforeinstallprompt event when available', async () => {
      render(<Default />);

      await waitFor(() => {
        expect(screen.getByText('Install BellSkill')).toBeTruthy();
      });

      const event = mockBeforeInstallPrompt();
      window.dispatchEvent(event);

      expect(screen.getByText('Install BellSkill')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility attributes', async () => {
      render(<Default />);

      await waitFor(() => {
        expect(screen.getByText('Install BellSkill')).toBeTruthy();
      });

      const dismissButton = screen.getByLabelText('Dismiss');
      expect(dismissButton.getAttribute('aria-label')).toBe('Dismiss');
    });
  });

  describe('Install Instructions', () => {
    it('should show iOS instructions for iOS devices', () => {
      setupMocks();
      mockUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      );

      render(<Default />);

      expect(screen.getByText(/Tap the.*share button below/)).toBeTruthy();
    });

    it('should show Android instructions for Android devices', () => {
      setupMocks();
      mockUserAgent(
        'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36',
      );

      render(<Default />);

      expect(screen.getByText(/Tap the.*share button below/)).toBeTruthy();
    });
  });

  describe('Story teardown', () => {
    // The Default story dispatches beforeinstallprompt on a timer. A timer left
    // pending outlives the jsdom window and throws "window is not defined" once
    // Vitest tears the environment down, failing the whole run while every test
    // still passes. Only the sync tests are fast enough to lose the race, so it
    // surfaces as an intermittent CI failure that never reproduces locally.
    it('leaves no pending timer after unmount', () => {
      vi.useFakeTimers();

      try {
        const { unmount } = render(<Default />);
        unmount();

        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Component Structure', () => {
    it('should have the correct CSS classes for positioning', async () => {
      const { container } = render(<Default />);

      await waitFor(() => {
        expect(screen.getByText('Install BellSkill')).toBeTruthy();
      });

      const promptContainer = container.firstChild as HTMLElement;
      expect(promptContainer.className).toContain('fixed');
      expect(promptContainer.className).toContain('bottom-4');
      expect(promptContainer.className).toContain('z-50');
    });

    it('should include the share icon in the text', async () => {
      render(<Default />);

      await waitFor(() => {
        expect(screen.getByText('Install BellSkill')).toBeTruthy();
      });

      const shareIcon = document.querySelector('svg');
      expect(shareIcon).toBeTruthy();
    });
  });
});
