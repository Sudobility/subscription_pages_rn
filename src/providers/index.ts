// Subscription providers (React Native) reachable from the package root.
export {
  SafeSubscriptionContext,
  STUB_SUBSCRIPTION_VALUE,
  useSafeSubscription,
  type SubscriptionContextValue,
} from './SafeSubscriptionContext';

// LazySubscriptionProvider is NOT re-exported here. It needs
// @sudobility/auth_lib (Firebase auth), and Metro bundles everything the root
// barrel imports — an app without auth_lib would stop bundling. It is exported
// from `@sudobility/subscription_pages_rn/firebase` (see ../firebase.ts).
//
// SubscriptionProviderWrapper is intentionally NOT exported, as on the web:
// LazySubscriptionProvider is its only caller.
