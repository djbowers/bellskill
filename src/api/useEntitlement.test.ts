import { deriveEntitlement } from './useEntitlement';

const NOW = new Date('2026-06-12T00:00:00Z');
const daysFromNow = (n: number) =>
  new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

describe('deriveEntitlement', () => {
  test('active trial -> premium access with days remaining', () => {
    const result = deriveEntitlement(
      {
        subscription_tier: 'free',
        trial_ends_at: daysFromNow(10),
        subscription_status: null,
        current_period_end: null,
      },
      NOW,
    );
    expect(result.effectiveAccess).toBe('premium');
    expect(result.isTrialing).toBe(true);
    expect(result.trialExpired).toBe(false);
    expect(result.trialDaysRemaining).toBe(10);
  });

  test('expired trial -> free, flagged as expired', () => {
    const result = deriveEntitlement(
      {
        subscription_tier: 'free',
        trial_ends_at: daysFromNow(-1),
        subscription_status: null,
        current_period_end: null,
      },
      NOW,
    );
    expect(result.effectiveAccess).toBe('free');
    expect(result.isTrialing).toBe(false);
    expect(result.trialExpired).toBe(true);
    expect(result.trialDaysRemaining).toBeNull();
  });

  test('premium tier -> premium regardless of trial', () => {
    const result = deriveEntitlement(
      {
        subscription_tier: 'premium',
        trial_ends_at: daysFromNow(-99),
        subscription_status: 'active',
        current_period_end: daysFromNow(30),
      },
      NOW,
    );
    expect(result.effectiveAccess).toBe('premium');
    expect(result.isPremium).toBe(true);
    expect(result.isTrialing).toBe(false);
  });

  test('free with no trial -> free, not expired', () => {
    const result = deriveEntitlement(
      {
        subscription_tier: 'free',
        trial_ends_at: null,
        subscription_status: null,
        current_period_end: null,
      },
      NOW,
    );
    expect(result.effectiveAccess).toBe('free');
    expect(result.trialExpired).toBe(false);
    expect(result.trialDaysRemaining).toBeNull();
  });

  test('null row (not loaded) -> free', () => {
    expect(deriveEntitlement(null, NOW).effectiveAccess).toBe('free');
  });

  test('rounds partial day up to whole days remaining', () => {
    const result = deriveEntitlement(
      {
        subscription_tier: 'free',
        trial_ends_at: new Date(
          NOW.getTime() + 1.2 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        subscription_status: null,
        current_period_end: null,
      },
      NOW,
    );
    expect(result.trialDaysRemaining).toBe(2);
  });
});
