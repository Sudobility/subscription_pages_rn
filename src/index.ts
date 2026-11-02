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
} from './adapters';

// Safe subscription context (moved here from building_blocks_rn so that
// building_blocks_rn keeps no subscription code — RN mirror of the web split).
export {
  SafeSubscriptionContext,
  STUB_SUBSCRIPTION_VALUE,
  useSafeSubscription,
  type SubscriptionContextValue,
} from './providers';
