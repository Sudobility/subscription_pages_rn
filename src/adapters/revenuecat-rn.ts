/**
 * RevenueCat React Native Adapter
 *
 * Adapter for RevenueCat React Native SDK (react-native-purchases).
 * Provides lazy loading of the SDK to avoid crashes if not installed.
 *
 * This is the REACT NATIVE implementation of subscription_lib's
 * `SubscriptionAdapter` seam. It lives here (not in subscription_lib) so the
 * platform-agnostic business logic never pulls in react-native-purchases /
 * react-native. Inject it via
 * `initializeSubscription({ adapter: createRevenueCatRNAdapter() })`.
 */

import type {
  AdapterCustomerInfo,
  AdapterEntitlementInfo,
  AdapterOffering,
  AdapterOfferings,
  AdapterPackage,
  AdapterPurchaseParams,
  AdapterPurchaseResult,
  SubscriptionAdapter,
} from '@sudobility/subscription_lib';

// RevenueCat RN SDK types - using any since module may not be installed
type PurchasesSDK = any;
type RNPackage = any;
type RNOffering = any;
type RNEntitlementInfo = any;
type RNCustomerInfo = any;

// Module state
let Purchases: PurchasesSDK | null = null;
let currentUserId: string | null = null;
let apiKey: string | null = null;
let configured = false;

/**
 * Lazily load the react-native-purchases module
 */
function getPurchases(): PurchasesSDK | null {
  if (!Purchases) {
    try {
      Purchases = require('react-native-purchases').default;
    } catch (e) {
      console.warn('[subscription] react-native-purchases not available:', e);
    }
  }
  return Purchases;
}

/**
 * Configure the RevenueCat RN adapter with API key.
 * Call this before initializing subscription_lib.
 */
export function configureRevenueCatRNAdapter(revenueCatApiKey: string): void {
  apiKey = revenueCatApiKey;
}

/**
 * Ensure RevenueCat is initialized with a user.
 */
async function ensureInitialized(): Promise<PurchasesSDK> {
  const sdk = getPurchases();
  if (!sdk) {
    throw new Error('react-native-purchases not available');
  }

  if (!apiKey) {
    throw new Error('RevenueCat not configured');
  }

  if (!currentUserId) {
    throw new Error(
      'RevenueCat user not set. Call setRevenueCatRNUser() first.'
    );
  }

  if (!configured) {
    await sdk.configure({ apiKey, appUserID: currentUserId });
    configured = true;
  }

  return sdk;
}

/**
 * Set the current user for RevenueCat.
 * Call this when user logs in.
 */
export async function setRevenueCatRNUser(
  userId: string,
  email?: string
): Promise<void> {
  const sdk = getPurchases();
  if (!sdk || !apiKey) {
    console.warn('[subscription] RevenueCat RN not configured');
    return;
  }

  // Skip if same user already set up
  if (currentUserId === userId && configured) {
    return;
  }

  try {
    if (!configured) {
      // First time configuration
      await sdk.configure({ apiKey, appUserID: userId });
      configured = true;
    } else if (currentUserId !== userId) {
      // Switch user - logout and login
      // logOut() throws if the current RC user is already anonymous
      // (e.g. after Firebase sign-out triggers a new anonymous sign-in)
      try {
        await sdk.logOut();
      } catch {
        // Ignore - already anonymous
      }
      await sdk.logIn(userId);
    }

    currentUserId = userId;

    // Set email attribute
    if (email) {
      try {
        await sdk.setEmail(email);
      } catch {
        // Ignore attribute errors
      }
    }
  } catch (error) {
    console.error('[subscription] Failed to set RevenueCat user:', error);
    throw error;
  }
}

/**
 * Clear the current user (on logout).
 */
export async function clearRevenueCatRNUser(): Promise<void> {
  const sdk = getPurchases();
  if (sdk && configured) {
    try {
      await sdk.logOut();
    } catch {
      // Ignore logout errors
    }
  }
  currentUserId = null;
}

/**
 * Check if RevenueCat has a user configured.
 */
export function hasRevenueCatRNUser(): boolean {
  return currentUserId !== null && configured;
}

/**
 * Convert RN package to adapter package format.
 */
function convertPackage(pkg: RNPackage): AdapterPackage {
  const product = pkg.product;

  return {
    identifier: pkg.identifier,
    packageType: pkg.packageType,
    product: {
      identifier: product.identifier,
      title: product.title,
      description: product.description || null,
      price: product.price,
      priceString: product.priceString,
      currencyCode: product.currencyCode,
      normalPeriodDuration: product.subscriptionPeriod || null,
      subscriptionOptions: product.defaultOption
        ? {
            [product.defaultOption.id]: {
              id: product.defaultOption.id,
              trial: product.defaultOption.freePhase
                ? {
                    periodDuration:
                      product.defaultOption.freePhase.billingPeriod?.iso8601 ||
                      null,
                    price: 0,
                    priceString: '$0',
                    cycleCount:
                      product.defaultOption.freePhase.billingCycleCount || 1,
                  }
                : null,
              introPrice: product.defaultOption.introPhase
                ? {
                    periodDuration:
                      product.defaultOption.introPhase.billingPeriod?.iso8601 ||
                      null,
                    price: product.defaultOption.introPhase.price?.amountMicros
                      ? product.defaultOption.introPhase.price.amountMicros /
                        1_000_000
                      : 0,
                    priceString:
                      product.defaultOption.introPhase.price?.formatted || '$0',
                    cycleCount:
                      product.defaultOption.introPhase.billingCycleCount || 1,
                  }
                : null,
            },
          }
        : undefined,
    },
  };
}

/**
 * Convert RN offering to adapter offering format.
 */
function convertOffering(offering: RNOffering): AdapterOffering {
  return {
    identifier: offering.identifier,
    metadata: offering.metadata || null,
    availablePackages: offering.availablePackages.map((pkg: RNPackage) =>
      convertPackage(pkg)
    ),
  };
}

/**
 * Convert RN entitlement to adapter format.
 */
function convertEntitlement(
  entitlement: RNEntitlementInfo
): AdapterEntitlementInfo {
  return {
    identifier: entitlement.identifier,
    productIdentifier: entitlement.productIdentifier,
    expirationDate: entitlement.expirationDate || null,
    willRenew: entitlement.willRenew,
    store: entitlement.store ?? undefined,
  };
}

/**
 * Create the subscription adapter for subscription_lib.
 */
export function createRevenueCatRNAdapter(): SubscriptionAdapter {
  return {
    async setUserId(userId: string | undefined, email?: string): Promise<void> {
      if (userId) {
        await setRevenueCatRNUser(userId, email);
      } else {
        await clearRevenueCatRNUser();
      }
    },

    async getOfferings(): Promise<AdapterOfferings> {
      // Return empty offerings if no user is set
      if (!currentUserId) {
        return { all: {}, current: null };
      }

      try {
        const sdk = await ensureInitialized();
        const offerings = await sdk.getOfferings();

        const all: AdapterOfferings['all'] = {};

        for (const [key, offering] of Object.entries(offerings.all)) {
          all[key] = convertOffering(offering as RNOffering);
        }

        return {
          all,
          current: offerings.current
            ? convertOffering(offerings.current)
            : null,
        };
      } catch (error) {
        console.error('[revenuecat-rn] Failed to get offerings:', error);
        return { all: {}, current: null };
      }
    },

    async getCustomerInfo(): Promise<AdapterCustomerInfo> {
      // Return empty customer info if no user is set
      if (!currentUserId) {
        return { activeSubscriptions: [], entitlements: { active: {} } };
      }

      try {
        const sdk = await ensureInitialized();
        const customerInfo: RNCustomerInfo = await sdk.getCustomerInfo();

        const active: AdapterCustomerInfo['entitlements']['active'] = {};

        for (const [id, entitlement] of Object.entries(
          customerInfo.entitlements.active
        )) {
          active[id] = convertEntitlement(entitlement as RNEntitlementInfo);
        }

        // Get management URL from the customer info
        const managementUrl = customerInfo.managementURL ?? undefined;

        return {
          activeSubscriptions: customerInfo.activeSubscriptions,
          entitlements: { active },
          managementUrl,
        };
      } catch (error) {
        console.error('[revenuecat-rn] Failed to get customer info:', error);
        return { activeSubscriptions: [], entitlements: { active: {} } };
      }
    },

    async purchase(
      params: AdapterPurchaseParams
    ): Promise<AdapterPurchaseResult> {
      const sdk = await ensureInitialized();

      // Find the package - prefer specific offering, fall back to searching all
      const offerings = await sdk.getOfferings();
      let packageToPurchase: RNPackage | undefined;

      const targetOffering = params.offeringId
        ? (offerings.all[params.offeringId] as RNOffering | undefined)
        : undefined;
      if (targetOffering) {
        packageToPurchase = targetOffering.availablePackages.find(
          (pkg: RNPackage) => pkg.identifier === params.packageId
        );
      }

      if (!packageToPurchase) {
        for (const offering of Object.values(offerings.all) as RNOffering[]) {
          packageToPurchase = offering.availablePackages.find(
            (pkg: RNPackage) => pkg.identifier === params.packageId
          );
          if (packageToPurchase) break;
        }
      }

      if (!packageToPurchase) {
        throw new Error(`Package not found: ${params.packageId}`);
      }

      const result = await sdk.purchasePackage(packageToPurchase);
      const customerInfo: RNCustomerInfo = result.customerInfo;

      // Convert customer info
      const active: AdapterCustomerInfo['entitlements']['active'] = {};
      for (const [id, entitlement] of Object.entries(
        customerInfo.entitlements.active
      )) {
        active[id] = convertEntitlement(entitlement as RNEntitlementInfo);
      }

      return {
        customerInfo: {
          activeSubscriptions: customerInfo.activeSubscriptions,
          entitlements: { active },
        },
      };
    },

    async restorePurchases(): Promise<AdapterCustomerInfo> {
      if (!currentUserId) {
        return { activeSubscriptions: [], entitlements: { active: {} } };
      }

      const sdk = await ensureInitialized();
      const customerInfo: RNCustomerInfo = await sdk.restorePurchases();

      const active: AdapterCustomerInfo['entitlements']['active'] = {};
      for (const [id, entitlement] of Object.entries(
        customerInfo.entitlements.active
      )) {
        active[id] = convertEntitlement(entitlement as RNEntitlementInfo);
      }

      return {
        activeSubscriptions: customerInfo.activeSubscriptions,
        entitlements: { active },
        managementUrl: customerInfo.managementURL ?? undefined,
      };
    },
  };
}
