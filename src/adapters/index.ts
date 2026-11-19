/**
 * Adapter Exports (React Native)
 *
 * React Native RevenueCat adapter (react-native-purchases) implementing
 * subscription_lib's SubscriptionAdapter seam.
 */
export {
  configureRevenueCatRNAdapter,
  createRevenueCatRNAdapter,
  setRevenueCatRNUser,
  clearRevenueCatRNUser,
  hasRevenueCatRNUser,
  type RevenueCatRNAdapterOptions,
} from './revenuecat-rn';

// The same five functions under the names @sudobility/subscription_pages (web)
// exports, so code written against either package finds its adapter here. They
// are this package's React Native adapter, not the web one. Two signatures are
// wider than the web's: `createRevenueCatAdapter` takes optional
// `{ usesNativeIap }`, and `clearRevenueCatUser` returns a promise (the native
// SDK's logOut is asynchronous).
export {
  configureRevenueCatRNAdapter as configureRevenueCatAdapter,
  createRevenueCatRNAdapter as createRevenueCatAdapter,
  setRevenueCatRNUser as setRevenueCatUser,
  clearRevenueCatRNUser as clearRevenueCatUser,
  hasRevenueCatRNUser as hasRevenueCatUser,
} from './revenuecat-rn';
