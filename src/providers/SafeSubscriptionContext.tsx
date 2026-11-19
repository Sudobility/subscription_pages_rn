/**
 * Safe Subscription Context
 *
 * Provides a context that can be safely used even when subscription
 * provider isn't loaded yet. Returns stub values for unauthenticated users.
 *
 * RN mirror of @sudobility/subscription_pages' SafeSubscriptionContext: the
 * value is the same `SubscriptionContextValue` the subscription provider
 * publishes (here from @sudobility/components-rn/subscription), and the stub
 * is the same no-op value, so a consumer reads one shape on both platforms.
 */

import { createContext, useContext } from 'react';
import type { SubscriptionContextValue } from '@sudobility/components-rn/subscription';

export type { SubscriptionContextValue };

/**
 * Stub subscription value for unauthenticated users or when
 * subscription provider hasn't loaded yet.
 */
export const STUB_SUBSCRIPTION_VALUE: SubscriptionContextValue = {
  products: [],
  currentSubscription: null,
  isLoading: false,
  error: null,
  initialize: () => Promise.resolve(),
  purchase: () => Promise.resolve(false),
  restore: () => Promise.resolve(false),
  refresh: () => Promise.resolve(),
  clearError: () => {},
};

/**
 * Context that provides subscription state with safe defaults.
 */
export const SafeSubscriptionContext = createContext<SubscriptionContextValue>(
  STUB_SUBSCRIPTION_VALUE
);

/**
 * Hook to safely access subscription context.
 * Returns stub values if provider isn't available.
 */
export function useSafeSubscription(): SubscriptionContextValue {
  return useContext(SafeSubscriptionContext);
}
