import { Platform } from 'react-native';
import { SubscriptionPlatform } from '@sudobility/types';

/**
 * The subscription platform this build runs on — what a page compares the
 * backend subscription's platform against when the app passes no
 * `currentPlatform`.
 *
 * The web page defaults to `SubscriptionPlatform.Web` because the web is where
 * it runs. One React Native package runs on several stores, so the same rule
 * ("the platform I am on") has to be read from `Platform.OS`; a fixed default
 * would report every non-iOS user's own subscription as bought elsewhere.
 * Windows bills through RevenueCat Web Billing, so its purchases are recorded
 * under Web.
 */
export function getCurrentSubscriptionPlatform(): SubscriptionPlatform {
  switch (Platform.OS) {
    case 'ios':
      return SubscriptionPlatform.iOS;
    case 'android':
      return SubscriptionPlatform.Android;
    case 'macos':
      return SubscriptionPlatform.macOS;
    default:
      return SubscriptionPlatform.Web;
  }
}
