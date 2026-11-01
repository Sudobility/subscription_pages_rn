/**
 * SubscriptionByDurationPage (React Native)
 *
 * Faithful mirror of @sudobility/subscription_pages' SubscriptionByDurationPage.
 * Groups packages by billing duration (monthly, yearly, etc.) and uses a
 * SegmentedControl to switch between durations.
 */

import { useState, useEffect } from 'react';
import { View, Text, Linking } from 'react-native';
import {
  SubscriptionPlatform,
  type SubscriptionPeriod,
} from '@sudobility/types';
import type { NetworkClient } from '@sudobility/types';
import {
  usePackagesByDuration,
  useUserSubscription,
  useBackendSubscription,
  getSubscriptionInstance,
  refreshSubscription,
} from '@sudobility/subscription_lib';
import type { PackageWithOffer } from '@sudobility/subscription_lib';
import {
  SubscriptionLayout,
  SubscriptionTile,
  SegmentedControl,
  type FreeTileConfig,
} from '@sudobility/components-rn/subscription';
import { CrossPlatformSubscriptionInfo } from '../components/CrossPlatformSubscriptionInfo';

export interface SubscriptionByDurationPageProps {
  /** Whether the user is logged in */
  isLoggedIn: boolean;
  /** Callback when user needs to navigate to login. offerId and packageId are passed when a specific package CTA is clicked. */
  onNavigateToLogin: (offerId?: string, packageId?: string) => void;
  /** User ID for subscription lookup (undefined if not logged in) */
  userId?: string;
  /** User email for subscription operations */
  userEmail?: string;
  /** Features list for each package, keyed by packageId */
  featuresByPackage?: Record<string, string[]>;
  /** Callback to get features by offerId and packageId */
  getFeaturesByPackageId?: (offerId: string, packageId: string) => string[];
  /** Callback to get features by entitlement */
  getFeaturesByEntitlement?: (entitlement: string) => string[];
  /** Features for the free tier */
  freeFeatures?: string[];
  /** Custom title for the page */
  title?: string;
  /** Additional NativeWind classes */
  className?: string;
  /** Current platform (defaults to iOS on RN) */
  currentPlatform?: SubscriptionPlatform;
  /** Network client for backend subscription fetch */
  networkClient?: NetworkClient;
  /** Backend API base URL */
  baseUrl?: string;
  /** Auth token for backend API */
  token?: string;
  /** Include sandbox purchases */
  testMode?: boolean;
  /**
   * Translation function for localizing labels. Falls back to the fallback
   * string if not provided.
   */
  t?: (key: string, fallback: string) => string;
}

export function SubscriptionByDurationPage({
  isLoggedIn,
  onNavigateToLogin,
  userId,
  userEmail,
  featuresByPackage,
  getFeaturesByPackageId,
  getFeaturesByEntitlement,
  freeFeatures,
  title = 'Choose Your Plan',
  className,
  currentPlatform = SubscriptionPlatform.iOS,
  networkClient,
  baseUrl,
  token,
  testMode,
  t: translate,
}: SubscriptionByDurationPageProps) {
  const loc = (key: string, fallback: string) =>
    translate ? translate(key, fallback) : fallback;

  // See SubscriptionByOfferPage: web billing requires a signed-in user to
  // purchase; native IAP (iOS / Android / macOS) buys anonymously, so only the
  // Web platform (Windows on RN) gates purchase on login.
  const requiresLoginToPurchase = currentPlatform === SubscriptionPlatform.Web;

  const {
    packagesByDuration,
    availableDurations,
    isLoading: isLoadingPackages,
    error: packagesError,
    refetch: refetchPackages,
  } = usePackagesByDuration();

  const {
    subscription,
    isLoading: isLoadingSubscription,
    error: subscriptionError,
  } = useUserSubscription({ userId, userEmail });

  // RN-only ordering fix (see SubscriptionByOfferPage): the native RevenueCat
  // adapter returns no offerings until an app-user id is set, and the packages
  // hook can fire before `useUserSubscription` sets it. Once the subscription
  // load settles, refetch if the durations came back empty.
  useEffect(() => {
    if (
      !isLoadingSubscription &&
      availableDurations.length === 0 &&
      !packagesError
    ) {
      refetchPackages();
    }
  }, [
    isLoadingSubscription,
    availableDurations.length,
    packagesError,
    refetchPackages,
  ]);

  // Backend subscription for platform detection
  const hasBackendConfig = !!(networkClient && baseUrl && token && userId);
  const backendSub = useBackendSubscription(
    networkClient ?? ({} as NetworkClient),
    baseUrl ?? '',
    token ?? '',
    userId ?? '',
    { testMode, enabled: hasBackendConfig }
  );

  const subscriptionPlatform = backendSub.data?.platform ?? null;
  const isPlatformMatch =
    !subscriptionPlatform || subscriptionPlatform === currentPlatform;

  const [selectedDuration, setSelectedDuration] =
    useState<SubscriptionPeriod | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Set default duration once available
  const activeDuration = selectedDuration ?? availableDurations[0] ?? null;

  const isLoading = isLoadingPackages || isLoadingSubscription;
  const error = packagesError || subscriptionError;

  const handlePurchase = async (packageId: string, offeringId: string) => {
    try {
      setIsPurchasing(true);
      setPurchaseError(null);
      const service = getSubscriptionInstance();
      await service.purchase({
        packageId,
        offeringId,
        customerEmail: userEmail,
      });
      await refreshSubscription();
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setIsPurchasing(false);
    }
  };

  const getFreeTileConfig = (): FreeTileConfig | undefined => {
    if (requiresLoginToPurchase && !isLoggedIn) {
      return {
        title: loc('free', 'Free'),
        price: '$0',
        features: freeFeatures ?? [],
        ctaButton: {
          label: loc('try_for_free', 'Try it for Free'),
          onClick: onNavigateToLogin,
        },
      };
    }

    const hasSubscription = subscription?.isActive && subscription.packageId;

    if (!hasSubscription) {
      // No active subscription - free is the current plan, no CTA
      return {
        title: loc('free', 'Free'),
        price: '$0',
        features: freeFeatures ?? [],
        topBadge: { text: loc('current', 'Current'), color: 'blue' },
      };
    }

    // Has a subscription - offer to manage
    return {
      title: loc('free', 'Free'),
      price: '$0',
      features: freeFeatures ?? [],
    };
  };

  const openManagementUrl = () => {
    if (subscription?.managementUrl) {
      Linking.openURL(subscription.managementUrl);
    }
  };

  const getPaidTileCta = (pkg: PackageWithOffer) => {
    if (requiresLoginToPurchase && !isLoggedIn) {
      return {
        label: loc('login_to_continue', 'Log in to Continue'),
        onClick: () => onNavigateToLogin(pkg.offerId, pkg.package.packageId),
      };
    }

    const hasSubscription = subscription?.isActive && subscription.packageId;
    const isCurrentPlan =
      subscription?.packageId === pkg.package.packageId &&
      subscription?.offeringId === pkg.offerId;

    if (hasSubscription) {
      // All CTAs go to management URL when subscribed
      return {
        label: isCurrentPlan
          ? loc('manage_subscription', 'Manage Subscription')
          : loc('change_subscription', 'Change Subscription'),
        onClick: openManagementUrl,
      };
    }

    return {
      label: loc('subscribe', 'Subscribe'),
      onClick: () => handlePurchase(pkg.package.packageId, pkg.offerId),
    };
  };

  if (isLoading) {
    return (
      <SubscriptionLayout title={title} className={className} variant='cta'>
        <Text className='text-muted-foreground'>
          {loc('loading_plans', 'Loading subscription plans...')}
        </Text>
      </SubscriptionLayout>
    );
  }

  // Cross-platform: show info instead of purchase UI
  if (!isPlatformMatch && backendSub.data) {
    return (
      <SubscriptionLayout title={title} className={className} variant='cta'>
        <CrossPlatformSubscriptionInfo
          backendSubscription={backendSub.data}
          managementUrl={subscription?.managementUrl}
          currentPlatform={currentPlatform}
        />
      </SubscriptionLayout>
    );
  }

  const displayError = purchaseError ?? (error ? error.message : null);

  const currentStatusConfig =
    isLoggedIn && subscription?.isActive && subscription.packageId
      ? {
          isActive: true as const,
          activeContent: {
            title: loc('active_subscription', 'Active Subscription'),
            fields: [
              ...(subscription.productId
                ? [
                    {
                      label: loc('plan', 'Plan'),
                      value: loc(
                        subscription.productId,
                        subscription.productId
                      ),
                    },
                  ]
                : []),
              ...(subscription.expirationDate
                ? [
                    {
                      label: loc('expires', 'Expires'),
                      value: subscription.expirationDate.toLocaleDateString(
                        undefined,
                        { dateStyle: 'long' }
                      ),
                    },
                  ]
                : []),
              ...(subscription.willRenew !== undefined
                ? [
                    {
                      label: loc('auto_renew', 'Auto-Renew'),
                      value: subscription.willRenew
                        ? loc('yes', 'Yes')
                        : loc('no', 'No'),
                    },
                  ]
                : []),
            ],
            ...(subscription.platform
              ? {
                  platform: {
                    label: loc(
                      'subscription_platform',
                      'Subscription Platform'
                    ),
                    value: subscription.platform,
                  },
                }
              : {}),
          },
        }
      : undefined;

  const currentPackages = activeDuration
    ? (packagesByDuration[activeDuration] ?? [])
    : [];

  return (
    <SubscriptionLayout
      title={title}
      className={className}
      variant='cta'
      error={displayError}
      currentStatus={currentStatusConfig}
      freeTileConfig={getFreeTileConfig()}
      aboveProducts={
        availableDurations.length > 1 ? (
          <View className='flex-row justify-center mb-6'>
            <SegmentedControl
              options={availableDurations.map(d => ({
                value: d,
                label: loc(d, d.charAt(0).toUpperCase() + d.slice(1)),
              }))}
              value={activeDuration ?? availableDurations[0]}
              onChange={value =>
                setSelectedDuration(value as SubscriptionPeriod)
              }
            />
          </View>
        ) : undefined
      }
    >
      {currentPackages.map(pkg => {
        const isCurrentPlan =
          isLoggedIn &&
          subscription?.isActive &&
          subscription.packageId === pkg.package.packageId &&
          subscription.offeringId === pkg.offerId;
        const cta = getPaidTileCta(pkg);

        let features: string[] = [];
        if (getFeaturesByPackageId) {
          features = getFeaturesByPackageId(pkg.offerId, pkg.package.packageId);
        } else if (getFeaturesByEntitlement && pkg.package.entitlements?.[0]) {
          features = getFeaturesByEntitlement(pkg.package.entitlements[0]);
        } else if (featuresByPackage) {
          features = featuresByPackage[pkg.package.packageId] ?? [];
        }

        return (
          <SubscriptionTile
            key={`${pkg.offerId}-${pkg.package.packageId}`}
            id={pkg.package.packageId}
            title={pkg.package.name}
            price={pkg.package.product?.priceString ?? '$0'}
            periodLabel={
              pkg.package.product ? `/${pkg.package.product.period}` : undefined
            }
            features={features}
            isSelected={false}
            onSelect={() => {}}
            isCurrentPlan={!!isCurrentPlan}
            ctaButton={cta}
            disabled={isPurchasing}
          />
        );
      })}
    </SubscriptionLayout>
  );
}
