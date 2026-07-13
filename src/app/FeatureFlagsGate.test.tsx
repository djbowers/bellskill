import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FLAGS_TIMEOUT_MS, FeatureFlagsGate } from './FeatureFlagsGate';

const { mockUseFeatureFlags } = vi.hoisted(() => ({
  mockUseFeatureFlags: vi.fn(),
}));
vi.mock('~/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/api')>()),
  useFeatureFlags: mockUseFeatureFlags,
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FeatureFlagsGate', () => {
  it('renders the app-init splash while flags are still resolving', () => {
    mockUseFeatureFlags.mockReturnValue({ features: {}, isPending: true });

    render(
      <FeatureFlagsGate>
        <div>app content</div>
      </FeatureFlagsGate>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('app content')).not.toBeInTheDocument();
  });

  it('renders children once flags resolve', () => {
    mockUseFeatureFlags.mockReturnValue({ features: {}, isPending: false });

    render(
      <FeatureFlagsGate>
        <div>app content</div>
      </FeatureFlagsGate>,
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('app content')).toBeInTheDocument();
  });

  it('renders children once the hard timeout elapses, even if the flags query never resolves', () => {
    mockUseFeatureFlags.mockReturnValue({ features: {}, isPending: true });

    render(
      <FeatureFlagsGate>
        <div>app content</div>
      </FeatureFlagsGate>,
    );

    expect(screen.queryByText('app content')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(FLAGS_TIMEOUT_MS);
    });

    expect(screen.getByText('app content')).toBeInTheDocument();
  });
});
