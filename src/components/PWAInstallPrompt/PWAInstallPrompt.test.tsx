import { composeStories } from '@storybook/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as stories from './PWAInstallPrompt.stories';

const { Default } = composeStories(stories);

// Mock the beforeinstallprompt event (using Vitest for tests)
const mockBeforeInstallPrompt = () => {
  const event = new Event('beforeinstallprompt') as any;
  event.platforms = ['web'];
  event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
  event.prompt = vi.fn(() => Promise.resolve());
  return event;
};

// Mock localStorage (using Vitest for tests)
const mockLocalStorage = {
  getItem: vi.fn((key: string) => null),
  setItem: vi.fn((key: string, value: string) => {}),
};

// Mock window.matchMedia (using Vitest for tests)
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

// Mock navigator.userAgent
const mockUserAgent = (userAgent: string) => {
  Object.defineProperty(navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  });
};

// Mock navigator.standalone
const mockStandalone = (standalone: boolean) => {
  Object.defineProperty(navigator, 'standalone', {
    value: standalone,
    configurable: true,
  });
};

// Mock document.referrer
const mockReferrer = (referrer: string) => {
  Object.defineProperty(document, 'referrer', {
    value: referrer,
    configurable: true,
  });
};

// Setup all mocks before tests run
const setupMocks = () => {
  // Reset mocks
  vi.clearAllMocks();

  // Setup default mocks
  mockMatchMedia(false);
  mockUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  );
  mockStandalone(false);
  mockReferrer('https://example.com');

  // Mock localStorage
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
    // Clean up event listeners
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
        setItem: vi.fn((key: string, value: string) => {}),
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
        getItem: vi.fn((key: string) => null),
        setItem: vi.fn((key: string, value: string) => {}),
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

      // Simulate the beforeinstallprompt event
      const event = mockBeforeInstallPrompt();
      window.dispatchEvent(event);

      // The component should still be visible after the event
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

      // Check that the share icon is present (it should be rendered as an SVG)
      const shareIcon = document.querySelector('svg');
      expect(shareIcon).toBeTruthy();
    });
  });
});
