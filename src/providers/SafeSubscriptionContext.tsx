/**
 * @fileoverview Safe subscription context for React Native.
 *
 * Provides a context that returns a stub value (`isSubscribed: false`) when
 * no provider wraps the tree. This allows components to read subscription
 * state without crashing when a subscription provider is absent. Uses a
 * default context value rather than null, so `useSafeSubscription()` never
 * throws and never returns null.
 *
 * Moved here from @sudobility/building_blocks_rn so that building_blocks_rn
 * keeps no subscription code — the RN mirror of the web split, where
 * SafeSubscriptionContext lives in @sudobility/subscription_pages.
 */
import { createContext, useContext } from 'react';

export interface SubscriptionContextValue {
  isSubscribed: boolean;
  subscriptionPlan: string | null;
  expirationDate: string | null;
  isLoading: boolean;
}

export const STUB_SUBSCRIPTION_VALUE: SubscriptionContextValue = {
  isSubscribed: false,
  subscriptionPlan: null,
  expirationDate: null,
  isLoading: false,
};

export const SafeSubscriptionContext = createContext<SubscriptionContextValue>(
  STUB_SUBSCRIPTION_VALUE
);

/**
 * Hook to safely access subscription context.
 * Returns stub value when no provider is available.
 */
export function useSafeSubscription(): SubscriptionContextValue {
  return useContext(SafeSubscriptionContext);
}
