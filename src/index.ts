export {
  SubscriptionByDurationPage,
  type SubscriptionByDurationPageProps,
  SubscriptionByOfferPage,
  type SubscriptionByOfferPageProps,
} from './pages';

// React Native RevenueCat adapter (implements subscription_lib's SubscriptionAdapter).
// Inject via initializeSubscription({ adapter: createRevenueCatRNAdapter() }).
export {
  configureRevenueCatRNAdapter,
  createRevenueCatRNAdapter,
  setRevenueCatRNUser,
  clearRevenueCatRNUser,
  hasRevenueCatRNUser,
  type RevenueCatRNAdapterOptions,
  // The web package's names for the same functions (see ./adapters).
  configureRevenueCatAdapter,
  createRevenueCatAdapter,
  setRevenueCatUser,
  clearRevenueCatUser,
  hasRevenueCatUser,
} from './adapters';

// Safe subscription context (moved here from building_blocks_rn so that
// building_blocks_rn keeps no subscription code — RN mirror of the web split).
//
// The web root also exports LazySubscriptionProvider. Here it lives at
// `@sudobility/subscription_pages_rn/firebase`, because it needs
// @sudobility/auth_lib and Metro bundles everything this barrel imports.
export {
  SafeSubscriptionContext,
  STUB_SUBSCRIPTION_VALUE,
  useSafeSubscription,
  type SubscriptionContextValue,
} from './providers';
