/**
 * The React Native RevenueCat adapter, as far as it can be exercised without
 * the native SDK: what it reports before a user is set, and that it degrades
 * to a warning rather than a crash when react-native-purchases is absent.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createRevenueCatRNAdapter,
  hasRevenueCatRNUser,
  setRevenueCatRNUser,
} from '../adapters';

describe('createRevenueCatRNAdapter', () => {
  it('bills through web billing unless the app says native IAP', () => {
    expect(createRevenueCatRNAdapter().usesNativeIap).toBe(false);
    expect(createRevenueCatRNAdapter({}).usesNativeIap).toBe(false);
    expect(
      createRevenueCatRNAdapter({ usesNativeIap: true }).usesNativeIap
    ).toBe(true);
  });

  it('reports nothing before a user is set', async () => {
    const adapter = createRevenueCatRNAdapter();
    const empty = { activeSubscriptions: [], entitlements: { active: {} } };

    expect(hasRevenueCatRNUser()).toBe(false);
    await expect(adapter.getOfferings()).resolves.toEqual({
      all: {},
      current: null,
    });
    await expect(adapter.getCustomerInfo()).resolves.toEqual(empty);
    await expect(adapter.restorePurchases()).resolves.toEqual(empty);
  });

  it('refuses a purchase before a user is set', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const adapter = createRevenueCatRNAdapter();

    await expect(
      adapter.purchase({ packageId: 'pro_monthly', offeringId: 'default' })
    ).rejects.toThrow();
  });

  it('warns instead of throwing when RevenueCat is not configured', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(setRevenueCatRNUser('user-1')).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      '[subscription] RevenueCat RN not configured'
    );
    expect(hasRevenueCatRNUser()).toBe(false);
  });
});
