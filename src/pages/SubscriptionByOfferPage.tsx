/**
 * SubscriptionByOfferPage (React Native)
 *
 * Faithful mirror of @sudobility/subscription_pages' SubscriptionByOfferPage.
 * Organizes packages by offering: a SegmentedControl switches between offerings
 * (with a 'Free' option).
 *
 * - Free tab: shows a free-tier tile
 * - Paid offering tabs: shows an offering description area (via callback),
 *   followed by a list of duration options with savings and price CTAs.
 */

import { useState, useEffect, type ReactNode } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import {
  SubscriptionPlatform,
  type SubscriptionPeriod,
} from '@sudobility/types';
import type { NetworkClient } from '@sudobility/types';
import {
  useAllOfferings,
  useOfferingPackages,
  useUserSubscription,
  useBackendSubscription,
  getSubscriptionInstance,
  refreshSubscription,
  periodToMonths,
} from '@sudobility/subscription_lib';
import type { SubscriptionPackage } from '@sudobility/subscription_lib';
import {
  SubscriptionLayout,
  SegmentedControl,
  type FreeTileConfig,
} from '@sudobility/components-rn/subscription';
import { cn, pressProps } from '@sudobility/components-rn';
import { CrossPlatformSubscriptionInfo } from '../components/CrossPlatformSubscriptionInfo';

export interface SubscriptionByOfferPageProps {
  /** Whether the user is logged in */
  isLoggedIn: boolean;
  /** Callback when user needs to navigate to login. offerId and packageId are passed when a specific package CTA is clicked. */
  onNavigateToLogin: (offerId?: string, packageId?: string) => void;
  /** User ID for subscription lookup */
  userId?: string;
  /** User email for subscription operations */
  userEmail?: string;
  /** Features list for each package, keyed by packageId */
  featuresByPackage?: Record<string, string[]>;
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
   * Translation function for localizing offer names, period labels, etc.
   * Keys passed: offer identifiers (e.g. "basic", "premium"), "free",
   * period names (e.g. "monthly", "yearly").
   * Falls back to the fallback string if not provided.
   */
  t?: (key: string, fallback: string) => string;
  /**
   * Render content describing what an offering includes.
   * Called with the offering identifier (e.g. "basic", "premium").
   */
  renderOfferingContent?: (offerId: string) => ReactNode;
  /**
   * If set, automatically select the specified offering on mount.
   * Must match an offering identifier from RevenueCat.
   */
  initialOfferId?: string;
}

/** Capitalize first letter fallback */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Period display names used as fallbacks */
const PERIOD_LABELS: Record<SubscriptionPeriod, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  lifetime: 'Lifetime',
};

/**
 * Calculate savings percentage of a package relative to a base (shortest)
 * package. Compares the monthly cost of each.
 */
function calcSavingsPercent(
  basePkg: SubscriptionPackage,
  pkg: SubscriptionPackage
): number | null {
  if (!basePkg.product || !pkg.product) return null;

  const baseMonths = periodToMonths(basePkg.product.period);
  const pkgMonths = periodToMonths(pkg.product.period);

  if (baseMonths <= 0 || pkgMonths <= 0) return null;
  if (baseMonths === Infinity || pkgMonths === Infinity) return null;
  if (baseMonths === pkgMonths) return null;

  const baseMonthlyCost = basePkg.product.price / baseMonths;
  const pkgMonthlyCost = pkg.product.price / pkgMonths;

  if (baseMonthlyCost <= 0) return null;

  const savings = Math.round(
    ((baseMonthlyCost - pkgMonthlyCost) / baseMonthlyCost) * 100
  );
  return savings > 0 ? savings : null;
}

export function SubscriptionByOfferPage({
  isLoggedIn,
  onNavigateToLogin,
  userId,
  userEmail,
  featuresByPackage: _featuresByPackage,
  freeFeatures,
  title = 'Choose Your Plan',
  className,
  currentPlatform = SubscriptionPlatform.iOS,
  networkClient,
  baseUrl,
  token,
  testMode,
  t: translate,
  renderOfferingContent,
  initialOfferId,
}: SubscriptionByOfferPageProps) {
  const loc = (key: string, fallback: string) =>
    translate ? translate(key, fallback) : fallback;

  // Whether a purchase requires a logged-in (real) user.
  //
  // This is the one behavioral divergence from the web page. On web billing
  // (RevenueCat's JS SDK / Stripe / rc_billing) the `purchase` call requires an
  // identified user, so an anonymous visitor must sign in first — the web page
  // therefore always gates purchase on `isLoggedIn`. With native in-app
  // purchases (Apple / Google), RevenueCat buys against an anonymous app-user
  // id, so a visitor can subscribe without signing in. The only RN platform on
  // web billing is Windows (SubscriptionPlatform.Web); every other platform
  // (iOS / Android / macOS) uses IAP.
  const requiresLoginToPurchase = currentPlatform === SubscriptionPlatform.Web;

  const {
    offerings,
    isLoading: isLoadingOfferings,
    error: offeringsError,
    refetch: refetchOfferings,
  } = useAllOfferings();

  const {
    subscription,
    isLoading: isLoadingSubscription,
    error: subscriptionError,
  } = useUserSubscription({ userId, userEmail });

  // RN-only ordering fix (the web adapter loads offerings anonymously, so the
  // web page does not need this): the native RevenueCat adapter returns no
  // offerings until an app-user id is set, and `useAllOfferings` can fire
  // before `useUserSubscription` has set it. Once the subscription load
  // settles (the user is now set in the adapter), refetch offerings if they
  // came back empty.
  useEffect(() => {
    if (!isLoadingSubscription && offerings.length === 0 && !offeringsError) {
      refetchOfferings();
    }
  }, [
    isLoadingSubscription,
    offerings.length,
    offeringsError,
    refetchOfferings,
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

  const [selectedSegment, setSelectedSegment] = useState<string>(
    initialOfferId ?? 'free'
  );

  // Sync selectedSegment when initialOfferId changes (e.g. switching techniques)
  useEffect(() => {
    if (initialOfferId) {
      setSelectedSegment(initialOfferId);
    }
  }, [initialOfferId]);

  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Always call useOfferingPackages (hooks can't be conditional).
  // Pass `offerings` to avoid a stale duplicate useAllOfferings instance.
  const fallbackOfferId = offerings[0]?.offerId ?? '';
  const activeOfferId =
    selectedSegment !== 'free' ? selectedSegment : fallbackOfferId;
  const {
    packages,
    isLoading: isLoadingPackages,
    error: packagesError,
  } = useOfferingPackages(activeOfferId, offerings);

  const isLoading =
    isLoadingOfferings || isLoadingSubscription || isLoadingPackages;
  const error = offeringsError || subscriptionError || packagesError;

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

  // Build segment options: Free + each offering (localized labels)
  const segmentOptions = [
    { value: 'free', label: loc('free', 'Free') },
    ...offerings.map(o => ({
      value: o.offerId,
      label: loc(o.offerId, capitalize(o.offerId)),
    })),
  ];

  // Shortest-duration package is the base for savings comparison
  const basePkg = packages[0] ?? null;

  const getFreeTileConfig = (): FreeTileConfig | undefined => {
    // Web billing only: an anonymous visitor must sign in before anything, so
    // the free tile invites them to sign up. With IAP there is no sign-in gate,
    // so an anonymous user is already on the free plan (handled below).
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

    // Has a subscription - no special free tile CTA
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

  const getCtaLabel = (pkg: SubscriptionPackage): string => {
    // Web billing only: an anonymous visitor must sign in before purchasing.
    if (requiresLoginToPurchase && !isLoggedIn) {
      return loc('login_to_continue', 'Log in to Continue');
    }
    const hasSubscription = subscription?.isActive && subscription.packageId;
    if (hasSubscription) {
      const isCurrentPlan =
        subscription?.packageId === pkg.packageId &&
        subscription?.offeringId === selectedSegment;
      return isCurrentPlan
        ? loc('manage_subscription', 'Manage Subscription')
        : loc('change_subscription', 'Change Subscription');
    }
    return loc('subscribe', 'Subscribe');
  };

  const getCtaAction = (pkg: SubscriptionPackage, offerId: string) => {
    // Web billing only: route an anonymous visitor to sign-in first. With IAP a
    // purchase proceeds anonymously, so fall through to handlePurchase.
    if (requiresLoginToPurchase && !isLoggedIn) {
      return () => onNavigateToLogin(offerId, pkg.packageId);
    }
    const hasSubscription = subscription?.isActive && subscription.packageId;
    if (hasSubscription) {
      // All CTAs go to management URL when subscribed
      return openManagementUrl;
    }
    return () => handlePurchase(pkg.packageId, offerId);
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

  const isFreeSelected = selectedSegment === 'free';

  return (
    <SubscriptionLayout
      title={title}
      className={className}
      variant='cta'
      error={displayError}
      currentStatus={currentStatusConfig}
      freeTileConfig={isFreeSelected ? getFreeTileConfig() : undefined}
      aboveProducts={
        segmentOptions.length > 1 ? (
          <View className='flex-row justify-center mb-6'>
            <SegmentedControl
              options={segmentOptions}
              value={selectedSegment}
              onChange={setSelectedSegment}
            />
          </View>
        ) : undefined
      }
    >
      {/* Offering content + duration list for paid offerings */}
      {!isFreeSelected && (
        <View className='gap-6'>
          {/* Offering description area */}
          {renderOfferingContent && (
            <View className='rounded-xl border border-border p-5 bg-card'>
              {renderOfferingContent(selectedSegment)}
            </View>
          )}

          {/* Duration options list */}
          <View className='gap-3'>
            {packages.map(pkg => {
              const period = pkg.product?.period;
              const periodLabel = period
                ? loc(period, PERIOD_LABELS[period] ?? capitalize(period))
                : pkg.name;
              const isCurrentPlan =
                isLoggedIn &&
                subscription?.isActive &&
                subscription.packageId === pkg.packageId &&
                subscription.offeringId === selectedSegment;
              const savings =
                basePkg && pkg.packageId !== basePkg.packageId
                  ? calcSavingsPercent(basePkg, pkg)
                  : null;
              const ctaLabel = getCtaLabel(pkg);
              const ctaAction = getCtaAction(pkg, selectedSegment);
              const priceStr = pkg.product?.priceString ?? '$0';

              return (
                <View
                  key={pkg.packageId}
                  className={cn(
                    'flex-row items-center justify-between rounded-xl p-4',
                    isCurrentPlan
                      ? 'border-2 border-primary bg-primary/10'
                      : 'border border-border bg-card'
                  )}
                >
                  {/* Left: duration title + savings subtitle */}
                  <View className='flex-1 min-w-0'>
                    <Text className='text-base font-semibold text-foreground'>
                      {periodLabel}
                    </Text>
                    {savings !== null ? (
                      <Text className='text-sm text-success'>
                        {loc('save_percent', `Save ${savings}%`).replace(
                          '{{percent}}',
                          String(savings)
                        )}
                      </Text>
                    ) : isCurrentPlan ? (
                      <Text className='text-sm text-primary'>
                        {loc('current_plan', 'Current Plan')}
                      </Text>
                    ) : null}
                  </View>

                  {/* Right: price CTA button */}
                  <Pressable
                    {...pressProps(ctaAction, isPurchasing)}
                    disabled={isPurchasing}
                    accessibilityRole='button'
                    className={cn(
                      'ml-4 rounded-lg px-4 py-2 bg-primary items-center',
                      isPurchasing && 'opacity-50'
                    )}
                  >
                    <Text className='text-sm font-semibold text-primary-foreground'>
                      {`${priceStr} · ${ctaLabel}`}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </SubscriptionLayout>
  );
}
