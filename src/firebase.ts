/**
 * Firebase-auth dependent exports.
 *
 * Import from '@sudobility/subscription_pages_rn/firebase'. Kept out of the
 * package root because these read the signed-in user from
 * @sudobility/auth_lib, an optional peer that only Firebase-auth apps install
 * (the same split @sudobility/building_blocks_rn makes with its `/firebase`
 * entry).
 *
 * The web package exports LazySubscriptionProvider from its root; the props
 * and behaviour are the same here.
 */
export {
  LazySubscriptionProvider,
  type LazySubscriptionProviderProps,
} from './providers/LazySubscriptionProvider';
