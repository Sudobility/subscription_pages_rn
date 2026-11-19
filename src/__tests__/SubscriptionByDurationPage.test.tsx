/**
 * SubscriptionByDurationPage — the cases @sudobility/subscription_pages' spec
 * of the same name runs against the web page, followed by the behaviour that
 * exists only on React Native (store management through Linking, the
 * platform-derived `currentPlatform`, native-IAP backend gating, the packages
 * refetch).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Linking, Platform } from 'react-native';
import { SubscriptionByDurationPage } from '../pages/SubscriptionByDurationPage';
import { render, firePress } from './test-utils';

type Period = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'lifetime';

// Mock subscription_lib
const mockUsePackagesByDuration = vi.fn();
const mockUseUserSubscription = vi.fn();
const mockUseIsUserSubscribable = vi.fn();
const mockUseBackendSubscription = vi.fn();
const mockIsSubscriptionNativeIap = vi.fn();
const mockGetSubscriptionInstance = vi.fn();
const mockRefreshSubscription = vi.fn();

vi.mock('@sudobility/subscription_lib', () => ({
  usePackagesByDuration: () => mockUsePackagesByDuration(),
  useUserSubscription: (...args: unknown[]) => mockUseUserSubscription(...args),
  useIsUserSubscribable: () => mockUseIsUserSubscribable(),
  useBackendSubscription: (...args: unknown[]) =>
    mockUseBackendSubscription(...args),
  isSubscriptionNativeIap: () => mockIsSubscriptionNativeIap(),
  getSubscriptionInstance: () => mockGetSubscriptionInstance(),
  refreshSubscription: () => mockRefreshSubscription(),
}));

// Mock subscription-components
const MockSubscriptionLayout = vi.fn(
  ({
    title,
    children,
    error,
    aboveProducts,
    freeTileConfig,
    currentStatus,
  }: any) => (
    <div data-testid='subscription-layout'>
      <h1>{title}</h1>
      {error && <div data-testid='error'>{error}</div>}
      {currentStatus?.isActive && (
        <div data-testid='current-status'>
          <span>{currentStatus.activeContent?.title}</span>
          {currentStatus.activeContent?.fields?.map(
            (f: { label: string; value: string }) => (
              <span key={f.label} data-testid={`status-${f.label}`}>
                {f.value}
              </span>
            )
          )}
          {currentStatus.activeContent?.platform && (
            <span data-testid='status-platform'>
              {currentStatus.activeContent.platform.label}:{' '}
              {currentStatus.activeContent.platform.value}
            </span>
          )}
        </div>
      )}
      {aboveProducts && <div data-testid='above-products'>{aboveProducts}</div>}
      {freeTileConfig && (
        <div data-testid='free-tile'>
          <span>{freeTileConfig.title}</span>
          {freeTileConfig.ctaButton && (
            <button onClick={freeTileConfig.ctaButton.onClick}>
              {freeTileConfig.ctaButton.label}
            </button>
          )}
          {freeTileConfig.topBadge && (
            <span data-testid='free-badge'>{freeTileConfig.topBadge.text}</span>
          )}
        </div>
      )}
      {children}
    </div>
  )
);

const MockSubscriptionTile = vi.fn(
  ({
    id,
    title,
    price,
    periodLabel,
    features,
    ctaButton,
    isCurrentPlan,
    disabled,
  }: any) => (
    <div data-testid={`tile-${id}`}>
      <span>{title}</span>
      <span data-testid={`price-${id}`}>
        {price}
        {periodLabel}
      </span>
      {features.map((feature: string) => (
        <span key={feature} data-testid={`feature-${id}`}>
          {feature}
        </span>
      ))}
      {isCurrentPlan && <span data-testid='current-plan-badge'>Current</span>}
      {ctaButton && (
        <button
          onClick={ctaButton.onClick}
          disabled={disabled}
          data-testid={`cta-${id}`}
        >
          {ctaButton.label}
        </button>
      )}
    </div>
  )
);

const MockSegmentedControl = vi.fn(({ options, value, onChange }: any) => (
  <div data-testid='segmented-control'>
    {options.map((opt: { value: string; label: string }) => (
      <button
        key={opt.value}
        data-testid={`segment-${opt.value}`}
        data-selected={opt.value === value}
        onClick={() => onChange(opt.value)}
      >
        {opt.label}
      </button>
    ))}
  </div>
));

vi.mock('@sudobility/components-rn/subscription', () => ({
  SubscriptionLayout: (props: any) => MockSubscriptionLayout(props),
  SubscriptionTile: (props: any) => MockSubscriptionTile(props),
  SegmentedControl: (props: any) => MockSegmentedControl(props),
}));

const makePackageWithOffer = (
  packageId: string,
  name: string,
  period: Period,
  priceString: string,
  offerId: string
) => ({
  package: {
    packageId,
    name,
    product: {
      productId: packageId,
      name,
      price: parseFloat(priceString.replace('$', '')),
      priceString,
      currency: 'USD',
      period,
      periodDuration: period === 'monthly' ? 'P1M' : 'P1Y',
    },
    entitlements: ['pro'],
  },
  offerId,
});

const monthlyPkg = makePackageWithOffer(
  'pro_monthly',
  'Pro Monthly',
  'monthly',
  '$9.99',
  'default'
);
const yearlyPkg = makePackageWithOffer(
  'pro_yearly',
  'Pro Yearly',
  'yearly',
  '$99.99',
  'default'
);

const refetchPackages = vi.fn();

function givenPackages(
  packagesByDuration: Record<string, unknown[]> = { monthly: [monthlyPkg] },
  extra = {}
) {
  mockUsePackagesByDuration.mockReturnValue({
    packagesByDuration,
    availableDurations: Object.keys(packagesByDuration),
    isLoading: false,
    error: null,
    refetch: refetchPackages,
    ...extra,
  });
}

function givenSubscription(subscription: unknown = null, extra = {}) {
  mockUseUserSubscription.mockReturnValue({
    subscription,
    isLoading: false,
    error: null,
    ...extra,
  });
}

const backendConfig = {
  networkClient: { get: vi.fn() } as any,
  baseUrl: 'https://api.example.com',
  token: 'token-1',
  userId: 'user-1',
};

describe('SubscriptionByDurationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshSubscription.mockResolvedValue(undefined);
    // Default: a user who can subscribe. Not-subscribable tests override this.
    mockUseIsUserSubscribable.mockReturnValue(true);
    mockIsSubscriptionNativeIap.mockReturnValue(false);
    mockUseBackendSubscription.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
  });

  it('shows loading state', async () => {
    givenPackages({}, { isLoading: true });
    givenSubscription(null, { isLoading: true });

    const { getByText } = await render(
      <SubscriptionByDurationPage onNavigateToLogin={() => {}} />
    );

    expect(getByText('Loading subscription plans...')).toBeTruthy();
  });

  it('shows error state', async () => {
    givenPackages({}, { error: new Error('Network error') });
    givenSubscription();

    const { getByTestId } = await render(
      <SubscriptionByDurationPage onNavigateToLogin={() => {}} />
    );

    expect(getByTestId('error').textContent).toBe('Network error');
  });

  it('shows "Try it for Free" and "Log in to Continue" when not logged in', async () => {
    mockUseIsUserSubscribable.mockReturnValue(false);
    givenPackages();
    givenSubscription();

    const onNavigateToLogin = vi.fn();

    const { getByText } = await render(
      <SubscriptionByDurationPage onNavigateToLogin={onNavigateToLogin} />
    );

    // Free tile CTA
    const freeTileButton = getByText('Try it for Free');
    expect(freeTileButton).toBeTruthy();
    await firePress(freeTileButton);
    expect(onNavigateToLogin).toHaveBeenCalledTimes(1);

    // Paid tile CTA
    const loginButton = getByText('Log in to Continue');
    expect(loginButton).toBeTruthy();
    await firePress(loginButton);
    expect(onNavigateToLogin).toHaveBeenCalledTimes(2);
    // The paid CTA names the offer and package the user chose.
    expect(onNavigateToLogin).toHaveBeenLastCalledWith(
      'default',
      'pro_monthly'
    );
  });

  it('shows "Current" badge on free tile when logged in with no subscription', async () => {
    givenPackages();
    givenSubscription();

    const { getByTestId, getByText } = await render(
      <SubscriptionByDurationPage
        onNavigateToLogin={() => {}}
        userId='user-1'
      />
    );

    expect(getByTestId('free-badge').textContent).toBe('Current');
    expect(getByText('Subscribe')).toBeTruthy();
  });

  it('shows current subscription status and isCurrentPlan on matching tile', async () => {
    givenPackages();
    givenSubscription({
      isActive: true,
      packageId: 'pro_monthly',
      productId: 'pro_monthly',
      offeringId: 'default',
      entitlements: ['pro'],
      period: 'monthly',
      expirationDate: new Date('2026-04-17'),
      willRenew: true,
      platform: 'ios',
    });

    const { getByTestId, getByText, queryByTestId } = await render(
      <SubscriptionByDurationPage
        onNavigateToLogin={() => {}}
        userId='user-1'
      />
    );

    expect(getByTestId('current-status')).toBeTruthy();
    expect(getByText('Active Subscription')).toBeTruthy();
    // The same fields, with the same labels, as the web page.
    expect(getByTestId('status-Plan').textContent).toBe('pro_monthly');
    expect(getByTestId('status-Expires').textContent).toBe(
      new Date('2026-04-17').toLocaleDateString(undefined, {
        dateStyle: 'long',
      })
    );
    expect(getByTestId('status-Auto-Renew').textContent).toBe('Yes');
    expect(getByTestId('status-platform').textContent).toBe(
      'Subscription Platform: ios'
    );
    // Current plan tile should have "Manage Subscription" CTA
    expect(getByTestId('cta-pro_monthly')).toBeTruthy();
    expect(getByText('Manage Subscription')).toBeTruthy();
    expect(getByTestId('current-plan-badge')).toBeTruthy();
    // A subscribed user's free tile carries neither badge nor CTA.
    expect(queryByTestId('free-badge')).toBeNull();
  });

  it('shows "Change Subscription" when logged in with different subscription', async () => {
    givenPackages({ yearly: [yearlyPkg] });
    givenSubscription({
      isActive: true,
      packageId: 'pro_monthly',
      productId: 'pro_monthly',
      entitlements: ['pro'],
      period: 'monthly',
    });

    const { getByText } = await render(
      <SubscriptionByDurationPage
        onNavigateToLogin={() => {}}
        userId='user-1'
      />
    );

    expect(getByText('Change Subscription')).toBeTruthy();
  });

  it('handles purchase flow', async () => {
    givenPackages();
    givenSubscription();

    const mockPurchase = vi.fn().mockResolvedValue(undefined);
    mockGetSubscriptionInstance.mockReturnValue({
      purchase: mockPurchase,
    });

    const { getByText } = await render(
      <SubscriptionByDurationPage
        onNavigateToLogin={() => {}}
        userId='user-1'
        userEmail='test@test.com'
      />
    );

    await firePress(getByText('Subscribe'));

    expect(mockPurchase).toHaveBeenCalledWith({
      packageId: 'pro_monthly',
      offeringId: 'default',
      customerEmail: 'test@test.com',
    });
    expect(mockRefreshSubscription).toHaveBeenCalled();
  });

  it('handles purchase error', async () => {
    givenPackages();
    givenSubscription();

    mockGetSubscriptionInstance.mockReturnValue({
      purchase: vi.fn().mockRejectedValue(new Error('Payment declined')),
    });

    const { getByText, getByTestId } = await render(
      <SubscriptionByDurationPage
        onNavigateToLogin={() => {}}
        userId='user-1'
      />
    );

    await firePress(getByText('Subscribe'));

    expect(getByTestId('error').textContent).toBe('Payment declined');
    expect(mockRefreshSubscription).not.toHaveBeenCalled();
  });

  it('renders segmented control with multiple durations', async () => {
    givenPackages({ monthly: [monthlyPkg], yearly: [yearlyPkg] });
    givenSubscription();

    const { getByTestId } = await render(
      <SubscriptionByDurationPage onNavigateToLogin={() => {}} />
    );

    expect(getByTestId('segmented-control')).toBeTruthy();
    expect(getByTestId('segment-monthly').textContent).toBe('Monthly');
    expect(getByTestId('segment-yearly').textContent).toBe('Yearly');
  });

  it('shows no segmented control for a single duration', async () => {
    givenPackages();
    givenSubscription();

    const { queryByTestId } = await render(
      <SubscriptionByDurationPage onNavigateToLogin={() => {}} />
    );

    expect(queryByTestId('segmented-control')).toBeNull();
  });

  it('switches duration on segment click', async () => {
    givenPackages({ monthly: [monthlyPkg], yearly: [yearlyPkg] });
    givenSubscription();

    const { getByTestId, queryByTestId } = await render(
      <SubscriptionByDurationPage onNavigateToLogin={() => {}} />
    );

    // Initially shows monthly
    expect(getByTestId('tile-pro_monthly')).toBeTruthy();
    expect(getByTestId('price-pro_monthly').textContent).toBe('$9.99/monthly');

    // Switch to yearly
    await firePress(getByTestId('segment-yearly'));
    expect(getByTestId('tile-pro_yearly')).toBeTruthy();
    expect(queryByTestId('tile-pro_monthly')).toBeNull();
  });

  it('uses custom title', async () => {
    givenPackages({});
    givenSubscription();

    const { getByText } = await render(
      <SubscriptionByDurationPage
        onNavigateToLogin={() => {}}
        title='Pricing Plans'
      />
    );

    expect(getByText('Pricing Plans')).toBeTruthy();
  });

  it('resolves tile features by package id, then entitlement, then the map', async () => {
    givenPackages();
    givenSubscription();
    const featuresByPackage = { pro_monthly: ['from map'] };
    const getFeaturesByEntitlement = vi.fn(() => ['from entitlement']);
    const getFeaturesByPackageId = vi.fn(() => ['from package id']);

    const all = await render(
      <SubscriptionByDurationPage
        onNavigateToLogin={() => {}}
        featuresByPackage={featuresByPackage}
        getFeaturesByEntitlement={getFeaturesByEntitlement}
        getFeaturesByPackageId={getFeaturesByPackageId}
      />
    );
    expect(all.getByTestId('feature-pro_monthly').textContent).toBe(
      'from package id'
    );
    expect(getFeaturesByPackageId).toHaveBeenCalledWith(
      'default',
      'pro_monthly'
    );
    all.unmount();

    const entitlement = await render(
      <SubscriptionByDurationPage
        onNavigateToLogin={() => {}}
        featuresByPackage={featuresByPackage}
        getFeaturesByEntitlement={getFeaturesByEntitlement}
      />
    );
    expect(entitlement.getByTestId('feature-pro_monthly').textContent).toBe(
      'from entitlement'
    );
    expect(getFeaturesByEntitlement).toHaveBeenCalledWith('pro');
    entitlement.unmount();

    const map = await render(
      <SubscriptionByDurationPage
        onNavigateToLogin={() => {}}
        featuresByPackage={featuresByPackage}
      />
    );
    expect(map.getByTestId('feature-pro_monthly').textContent).toBe('from map');
  });

  describe('React Native specifics', () => {
    it('opens the store management URL when a subscribed CTA is pressed', async () => {
      givenPackages();
      givenSubscription({
        isActive: true,
        packageId: 'pro_monthly',
        offeringId: 'default',
        managementUrl: 'https://play.google.com/store/account/subscriptions',
      });
      const mockPurchase = vi.fn();
      mockGetSubscriptionInstance.mockReturnValue({ purchase: mockPurchase });

      const { getByText } = await render(
        <SubscriptionByDurationPage
          onNavigateToLogin={() => {}}
          userId='user-1'
        />
      );

      await firePress(getByText('Manage Subscription'));

      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://play.google.com/store/account/subscriptions'
      );
      expect(mockPurchase).not.toHaveBeenCalled();
    });

    it('asks the backend for the subscription of a user who can subscribe', async () => {
      mockIsSubscriptionNativeIap.mockReturnValue(true);
      givenPackages();
      givenSubscription();

      await render(
        <SubscriptionByDurationPage
          onNavigateToLogin={() => {}}
          testMode
          {...backendConfig}
        />
      );

      expect(mockUseBackendSubscription).toHaveBeenLastCalledWith(
        backendConfig.networkClient,
        'https://api.example.com',
        'token-1',
        'user-1',
        { testMode: true, enabled: true, nativeIap: true }
      );
    });

    it('does not ask the backend for a user who cannot subscribe', async () => {
      mockUseIsUserSubscribable.mockReturnValue(false);
      givenPackages();
      givenSubscription();

      await render(
        <SubscriptionByDurationPage
          onNavigateToLogin={() => {}}
          {...backendConfig}
        />
      );

      expect(mockUseBackendSubscription.mock.lastCall?.[4]).toMatchObject({
        enabled: false,
        nativeIap: false,
      });
    });

    it('shows where the subscription was bought when it was another platform', async () => {
      givenPackages();
      givenSubscription();
      mockUseBackendSubscription.mockReturnValue({
        data: { platform: 'android', entitlements: ['pro'] },
        isLoading: false,
        error: null,
      });

      const { getByText, queryByTestId, container } = await render(
        <SubscriptionByDurationPage
          onNavigateToLogin={() => {}}
          {...backendConfig}
        />
      );

      expect(getByText('Subscription Active')).toBeTruthy();
      expect(container.textContent).toContain(
        'Your subscription was purchased on Android. To manage your subscription, please visit your Android settings.'
      );
      expect(queryByTestId('tile-pro_monthly')).toBeNull();
      expect(queryByTestId('free-tile')).toBeNull();
    });

    it.each([
      ['ios', 'ios'],
      ['android', 'android'],
      ['macos', 'macos'],
      ['windows', 'web'],
    ])(
      'treats a subscription bought on this platform as its own (%s)',
      async (os, backendPlatform) => {
        Platform.OS = os;
        givenPackages();
        givenSubscription();
        mockUseBackendSubscription.mockReturnValue({
          data: { platform: backendPlatform, entitlements: ['pro'] },
          isLoading: false,
          error: null,
        });

        const { queryByText, getByTestId } = await render(
          <SubscriptionByDurationPage
            onNavigateToLogin={() => {}}
            {...backendConfig}
          />
        );

        // No `currentPlatform` passed: the page reads the running platform.
        expect(queryByText('Subscription Active')).toBeNull();
        expect(getByTestId('tile-pro_monthly')).toBeTruthy();
      }
    );

    it('refetches packages that came back empty once the user has settled', async () => {
      givenPackages({});
      givenSubscription();

      await render(
        <SubscriptionByDurationPage
          onNavigateToLogin={() => {}}
          userId='user-1'
        />
      );

      expect(refetchPackages).toHaveBeenCalledTimes(1);
    });

    it('does not refetch packages that loaded, failed, or are still waiting on the user', async () => {
      givenPackages();
      givenSubscription();
      const loaded = await render(
        <SubscriptionByDurationPage
          onNavigateToLogin={() => {}}
          userId='user-1'
        />
      );
      loaded.unmount();

      givenPackages({}, { error: new Error('offline') });
      const failed = await render(
        <SubscriptionByDurationPage
          onNavigateToLogin={() => {}}
          userId='user-1'
        />
      );
      failed.unmount();

      givenPackages({});
      givenSubscription(null, { isLoading: true });
      await render(
        <SubscriptionByDurationPage
          onNavigateToLogin={() => {}}
          userId='user-1'
        />
      );

      expect(refetchPackages).not.toHaveBeenCalled();
    });
  });
});
