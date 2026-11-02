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
