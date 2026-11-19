/**
 * SubscriptionByOfferPage — the cases @sudobility/subscription_pages' spec of
 * the same name runs against the web page, followed by the behaviour that
 * exists only on React Native (store management through Linking, the
 * platform-derived `currentPlatform`, native-IAP backend gating, the
 * offerings refetch).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Linking, Platform } from 'react-native';
import { SubscriptionByOfferPage } from '../pages/SubscriptionByOfferPage';
import { render, firePress } from './test-utils';

// Mock subscription_lib
const mockUseAllOfferings = vi.fn();
const mockUseOfferingPackages = vi.fn();
const mockUseUserSubscription = vi.fn();
const mockUseIsUserSubscribable = vi.fn();
const mockUseBackendSubscription = vi.fn();
const mockIsSubscriptionNativeIap = vi.fn();
const mockGetSubscriptionInstance = vi.fn();
const mockRefreshSubscription = vi.fn();

vi.mock('@sudobility/subscription_lib', () => ({
  useAllOfferings: () => mockUseAllOfferings(),
  useOfferingPackages: (...args: unknown[]) => mockUseOfferingPackages(...args),
  useUserSubscription: (...args: unknown[]) => mockUseUserSubscription(...args),
  useIsUserSubscribable: () => mockUseIsUserSubscribable(),
  useBackendSubscription: (...args: unknown[]) =>
    mockUseBackendSubscription(...args),
  isSubscriptionNativeIap: () => mockIsSubscriptionNativeIap(),
  getSubscriptionInstance: () => mockGetSubscriptionInstance(),
  refreshSubscription: () => mockRefreshSubscription(),
  periodToMonths: (period: string) => {
    const map: Record<string, number> = {
      weekly: 0.25,
      monthly: 1,
      quarterly: 3,
      yearly: 12,
      lifetime: Infinity,
    };
    return map[period] ?? 1;
  },
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
  SegmentedControl: (props: any) => MockSegmentedControl(props),
}));

vi.mock('@sudobility/components-rn', () => ({
  cn: (...parts: unknown[]) => parts.filter(Boolean).join(' '),
  pressProps: (onPress: unknown) => ({ onPress: onPress ?? undefined }),
}));

const mockOfferings = [
  {
    offerId: 'basic',
    metadata: {},
    packages: [
      {
        packageId: 'basic_monthly',
        name: 'Basic Monthly',
        product: {
          productId: 'basic_monthly',
          name: 'Basic Monthly',
          price: 4.99,
          priceString: '$4.99',
          currency: 'USD',
          period: 'monthly' as const,
          periodDuration: 'P1M',
        },
        entitlements: ['basic'],
      },
    ],
  },
  {
    offerId: 'premium',
    metadata: {},
    packages: [
      {
        packageId: 'premium_monthly',
        name: 'Premium Monthly',
        product: {
          productId: 'premium_monthly',
          name: 'Premium Monthly',
          price: 9.99,
          priceString: '$9.99',
          currency: 'USD',
          period: 'monthly' as const,
          periodDuration: 'P1M',
        },
        entitlements: ['premium'],
      },
    ],
  },
];

const refetchOfferings = vi.fn();

function givenOfferings(offerings: unknown[] = mockOfferings, extra = {}) {
  mockUseAllOfferings.mockReturnValue({
    offerings,
    isLoading: false,
    error: null,
    refetch: refetchOfferings,
    ...extra,
  });
}

function givenPackages(packages: unknown[] = [], extra = {}) {
  mockUseOfferingPackages.mockReturnValue({
    packages,
    isLoading: false,
    error: null,
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

describe('SubscriptionByOfferPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshSubscription.mockResolvedValue(undefined);
    // Default: a user who can subscribe (web billing + logged in). Tests that
    // exercise the not-subscribable path override this to false.
    mockUseIsUserSubscribable.mockReturnValue(true);
    mockIsSubscriptionNativeIap.mockReturnValue(false);
    mockUseBackendSubscription.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    });
  });

  it('shows loading state', async () => {
    givenOfferings([], { isLoading: true });
    givenPackages([], { isLoading: true });
    givenSubscription(null, { isLoading: true });

    const { getByText } = await render(
      <SubscriptionByOfferPage onNavigateToLogin={() => {}} />
    );

    expect(getByText('Loading subscription plans...')).toBeTruthy();
  });

  it('shows error state', async () => {
    givenOfferings([], { error: new Error('Failed to load') });
    givenPackages();
    givenSubscription();

    const { getByTestId } = await render(
      <SubscriptionByOfferPage onNavigateToLogin={() => {}} />
    );

    expect(getByTestId('error').textContent).toBe('Failed to load');
  });

  it('shows free tile with "Try it for Free" when not logged in', async () => {
    mockUseIsUserSubscribable.mockReturnValue(false);
    givenOfferings();
    givenPackages();
    givenSubscription();

    const onNavigateToLogin = vi.fn();

    const { getByText } = await render(
      <SubscriptionByOfferPage
        onNavigateToLogin={onNavigateToLogin}
        freeFeatures={['Basic feature']}
      />
    );

    // Default segment is 'free', so free tile should show
    const tryFreeButton = getByText('Try it for Free');
    expect(tryFreeButton).toBeTruthy();
    await firePress(tryFreeButton);
    expect(onNavigateToLogin).toHaveBeenCalledTimes(1);
  });

  it('shows "Current" on free tile when logged in without subscription', async () => {
    givenOfferings();
    givenPackages();
    givenSubscription();

    const { getByTestId } = await render(
      <SubscriptionByOfferPage onNavigateToLogin={() => {}} userId='user-1' />
    );

    expect(getByTestId('free-badge').textContent).toBe('Current');
  });

  it('shows segmented control with free and offering segments', async () => {
    givenOfferings();
    givenPackages();
    givenSubscription();

    const { getByTestId } = await render(
      <SubscriptionByOfferPage onNavigateToLogin={() => {}} />
    );

    expect(getByTestId('segment-free').textContent).toBe('Free');
    expect(getByTestId('segment-basic').textContent).toBe('Basic');
    expect(getByTestId('segment-premium').textContent).toBe('Premium');
  });

  it('shows no segmented control when there are no offerings', async () => {
    givenOfferings([]);
    givenPackages();
    givenSubscription();

    const { queryByTestId } = await render(
      <SubscriptionByOfferPage onNavigateToLogin={() => {}} />
    );

    expect(queryByTestId('segmented-control')).toBeNull();
  });

  it('shows duration list when switching to an offering segment', async () => {
    mockUseIsUserSubscribable.mockReturnValue(false);
    givenOfferings();
    givenPackages(mockOfferings[0].packages);
    givenSubscription();

    const onNavigateToLogin = vi.fn();

    const { getByTestId, getByText, queryByTestId } = await render(
      <SubscriptionByOfferPage onNavigateToLogin={onNavigateToLogin} />
    );

    // Switch to 'basic' offering
    await firePress(getByTestId('segment-basic'));

    // Shows period label and login CTA with price
    expect(getByText('Monthly')).toBeTruthy();
    const cta = getByText('$4.99 · Log in to Continue');
    expect(cta).toBeTruthy();
    // The free tile belongs to the Free segment only.
    expect(queryByTestId('free-tile')).toBeNull();

    // The CTA hands the chosen offer and package to the login callback.
    await firePress(cta);
    expect(onNavigateToLogin).toHaveBeenCalledWith('basic', 'basic_monthly');
  });

  it('shows "Subscribe" CTAs when logged in without subscription', async () => {
    givenOfferings();
    givenPackages(mockOfferings[0].packages);
    givenSubscription();

    const { getByTestId, getByText } = await render(
      <SubscriptionByOfferPage onNavigateToLogin={() => {}} userId='user-1' />
    );

    // Switch to offering
    await firePress(getByTestId('segment-basic'));

    expect(getByText('$4.99 · Subscribe')).toBeTruthy();
  });

  it('shows current subscription status', async () => {
    givenOfferings();
    givenPackages(mockOfferings[0].packages);
    givenSubscription({
      isActive: true,
      packageId: 'basic_monthly',
      productId: 'basic_monthly',
      entitlements: ['basic'],
      period: 'monthly',
      expirationDate: new Date('2026-04-17'),
      willRenew: true,
    });

    const { getByTestId, getByText } = await render(
      <SubscriptionByOfferPage onNavigateToLogin={() => {}} userId='user-1' />
    );

    expect(getByTestId('current-status')).toBeTruthy();
    expect(getByText('Active Subscription')).toBeTruthy();
    // The same three fields, with the same labels, as the web page.
    expect(getByTestId('status-Plan').textContent).toBe('basic_monthly');
    expect(getByTestId('status-Expires').textContent).toBe(
      new Date('2026-04-17').toLocaleDateString(undefined, {
        dateStyle: 'long',
      })
    );
    expect(getByTestId('status-Auto-Renew').textContent).toBe('Yes');
  });

  it('marks current plan in the list', async () => {
    givenOfferings();
    givenPackages(mockOfferings[0].packages);
    givenSubscription({
      isActive: true,
      packageId: 'basic_monthly',
      productId: 'basic_monthly',
      offeringId: 'basic',
      entitlements: ['basic'],
      period: 'monthly',
    });

    const { getByTestId, getByText } = await render(
      <SubscriptionByOfferPage onNavigateToLogin={() => {}} userId='user-1' />
    );

    // Switch to basic offering
    await firePress(getByTestId('segment-basic'));

    // The row is subtitled "Current Plan" and its CTA manages it.
    expect(getByText('Current Plan')).toBeTruthy();
    expect(getByText('$4.99 · Manage Subscription')).toBeTruthy();
  });

  it('handles purchase flow', async () => {
    givenOfferings();
    givenPackages(mockOfferings[0].packages);
    givenSubscription();

    const mockPurchase = vi.fn().mockResolvedValue(undefined);
    mockGetSubscriptionInstance.mockReturnValue({
      purchase: mockPurchase,
    });

    const { getByTestId, getByText } = await render(
      <SubscriptionByOfferPage
        onNavigateToLogin={() => {}}
        userId='user-1'
        userEmail='test@test.com'
      />
    );

    // Switch to basic offering
    await firePress(getByTestId('segment-basic'));

    await firePress(getByText('$4.99 · Subscribe'));

    expect(mockPurchase).toHaveBeenCalledWith({
      packageId: 'basic_monthly',
      offeringId: 'basic',
      customerEmail: 'test@test.com',
    });
    expect(mockRefreshSubscription).toHaveBeenCalled();
  });

  it('handles purchase error', async () => {
    givenOfferings();
    givenPackages(mockOfferings[0].packages);
    givenSubscription();

    mockGetSubscriptionInstance.mockReturnValue({
      purchase: vi.fn().mockRejectedValue(new Error('Payment failed')),
    });

    const { getByTestId, getByText } = await render(
      <SubscriptionByOfferPage onNavigateToLogin={() => {}} userId='user-1' />
    );

    // Switch to basic offering
    await firePress(getByTestId('segment-basic'));

    await firePress(getByText('$4.99 · Subscribe'));

    expect(getByTestId('error').textContent).toBe('Payment failed');
    expect(mockRefreshSubscription).not.toHaveBeenCalled();
  });

  it('uses custom title', async () => {
    givenOfferings([]);
    givenPackages();
    givenSubscription();

    const { getByText } = await render(
      <SubscriptionByOfferPage
        onNavigateToLogin={() => {}}
        title='Select a Plan'
      />
    );

    expect(getByText('Select a Plan')).toBeTruthy();
  });

  it('defaults the title to "Choose Your Plan"', async () => {
    givenOfferings([]);
    givenPackages();
    givenSubscription();

    const { getByText } = await render(
      <SubscriptionByOfferPage onNavigateToLogin={() => {}} />
    );

    expect(getByText('Choose Your Plan')).toBeTruthy();
  });

  it('shows "Change Subscription" when logged in with different subscription', async () => {
    givenOfferings();
    givenPackages(mockOfferings[1].packages);
    givenSubscription({
      isActive: true,
      packageId: 'basic_monthly',
      productId: 'basic_monthly',
      entitlements: ['basic'],
      period: 'monthly',
    });

    const { getByTestId, getByText } = await render(
      <SubscriptionByOfferPage onNavigateToLogin={() => {}} userId='user-1' />
    );

    // Switch to premium offering
    await firePress(getByTestId('segment-premium'));

    expect(getByText('$9.99 · Change Subscription')).toBeTruthy();
  });

  it('renders offering content when renderOfferingContent is provided', async () => {
    givenOfferings();
    givenPackages(mockOfferings[0].packages);
    givenSubscription();

    const { getByTestId } = await render(
      <SubscriptionByOfferPage
        onNavigateToLogin={() => {}}
        renderOfferingContent={offerId => (
          <p data-testid='offering-content'>Features for {offerId}</p>
        )}
      />
    );

    // Switch to basic offering
    await firePress(getByTestId('segment-basic'));

    expect(getByTestId('offering-content').textContent).toBe(
      'Features for basic'
    );
  });

  it('shows savings for longer duration packages', async () => {
    const multiDurationPackages = [
      {
        packageId: 'basic_monthly',
        name: 'Basic Monthly',
        product: {
          productId: 'basic_monthly',
          name: 'Basic Monthly',
          price: 4.99,
          priceString: '$4.99',
          currency: 'USD',
          period: 'monthly' as const,
          periodDuration: 'P1M',
        },
        entitlements: ['basic'],
      },
      {
        packageId: 'basic_yearly',
        name: 'Basic Yearly',
        product: {
          productId: 'basic_yearly',
          name: 'Basic Yearly',
          price: 39.99,
          priceString: '$39.99',
          currency: 'USD',
          period: 'yearly' as const,
          periodDuration: 'P1Y',
        },
        entitlements: ['basic'],
      },
    ];

    givenOfferings();
    givenPackages(multiDurationPackages);
    givenSubscription();

    const { getByTestId, getByText, getAllByText } = await render(
      <SubscriptionByOfferPage onNavigateToLogin={() => {}} userId='user-1' />
    );

    await firePress(getByTestId('segment-basic'));

    // Yearly should show savings vs monthly
    // monthly: $4.99/mo, yearly: $39.99/12 = $3.33/mo → save 33%
    expect(getByText('Save 33%')).toBeTruthy();
    // Only the longer package is compared against the base one.
    expect(getAllByText(/^Save /)).toHaveLength(1);
  });

  it('selects the offering named by initialOfferId', async () => {
    givenOfferings();
    givenPackages(mockOfferings[1].packages);
    givenSubscription();

    const { getByTestId, queryByTestId } = await render(
      <SubscriptionByOfferPage
        onNavigateToLogin={() => {}}
        userId='user-1'
        initialOfferId='premium'
      />
    );

    expect(getByTestId('segment-premium').dataset.selected).toBe('true');
    expect(queryByTestId('free-tile')).toBeNull();
    // The packages hook is asked for that offering, from the loaded list.
    expect(mockUseOfferingPackages).toHaveBeenLastCalledWith(
      'premium',
      mockOfferings
    );
  });

  it('passes every label through t with the web fallbacks', async () => {
    mockUseIsUserSubscribable.mockReturnValue(false);
    givenOfferings();
    givenPackages(mockOfferings[0].packages);
    givenSubscription();

    const t = vi.fn((key: string, _fallback: string) => `t:${key}`);

    const { getByTestId, getByText } = await render(
      <SubscriptionByOfferPage onNavigateToLogin={() => {}} t={t} />
    );

    expect(getByTestId('segment-free').textContent).toBe('t:free');
    expect(getByTestId('segment-basic').textContent).toBe('t:basic');
    expect(getByText('t:try_for_free')).toBeTruthy();

    await firePress(getByTestId('segment-basic'));
    expect(getByText('t:monthly')).toBeTruthy();
    expect(getByText('$4.99 · t:login_to_continue')).toBeTruthy();

    expect(t).toHaveBeenCalledWith('free', 'Free');
    expect(t).toHaveBeenCalledWith('basic', 'Basic');
    expect(t).toHaveBeenCalledWith('try_for_free', 'Try it for Free');
    expect(t).toHaveBeenCalledWith('monthly', 'Monthly');
    expect(t).toHaveBeenCalledWith('login_to_continue', 'Log in to Continue');
  });

  describe('React Native specifics', () => {
    it('opens the store management URL when a subscribed CTA is pressed', async () => {
      givenOfferings();
      givenPackages(mockOfferings[1].packages);
      givenSubscription({
        isActive: true,
        packageId: 'basic_monthly',
        productId: 'basic_monthly',
        offeringId: 'basic',
        entitlements: ['basic'],
        managementUrl: 'https://apps.apple.com/account/subscriptions',
      });
      const mockPurchase = vi.fn();
      mockGetSubscriptionInstance.mockReturnValue({ purchase: mockPurchase });

      const { getByTestId, getByText } = await render(
        <SubscriptionByOfferPage onNavigateToLogin={() => {}} userId='user-1' />
      );

      await firePress(getByTestId('segment-premium'));
      await firePress(getByText('$9.99 · Change Subscription'));

      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://apps.apple.com/account/subscriptions'
      );
      // A subscribed user is sent to the store, never into a second purchase.
      expect(mockPurchase).not.toHaveBeenCalled();
    });

    it('asks the backend for the subscription of a user who can subscribe', async () => {
      mockIsSubscriptionNativeIap.mockReturnValue(true);
      givenOfferings();
      givenPackages();
      givenSubscription();

      await render(
        <SubscriptionByOfferPage
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
      givenOfferings();
      givenPackages();
      givenSubscription();

      await render(
        <SubscriptionByOfferPage
          onNavigateToLogin={() => {}}
          {...backendConfig}
        />
      );

      expect(mockUseBackendSubscription.mock.lastCall?.[4]).toMatchObject({
        enabled: false,
        nativeIap: false,
      });
    });

    it('does not ask the backend without a complete backend config', async () => {
      givenOfferings();
      givenPackages();
      givenSubscription();

      await render(
        <SubscriptionByOfferPage onNavigateToLogin={() => {}} userId='user-1' />
      );

      expect(mockUseBackendSubscription.mock.lastCall?.[4]).toMatchObject({
        enabled: false,
      });
    });

    it('shows where the subscription was bought when it was another platform', async () => {
      givenOfferings();
      givenPackages();
      givenSubscription({
        isActive: true,
        packageId: 'basic_monthly',
        managementUrl: 'https://billing.example.com/manage',
      });
      mockUseBackendSubscription.mockReturnValue({
        data: {
          platform: 'web',
          entitlements: ['basic', 'extras'],
          subscriptionStartedAt: '2026-01-15T00:00:00.000Z',
        },
        isLoading: false,
        error: null,
      });

      const { getByText, queryByTestId, container } = await render(
        <SubscriptionByOfferPage
          onNavigateToLogin={() => {}}
          {...backendConfig}
        />
      );

      // The cross-platform panel replaces the purchase UI.
      expect(getByText('Subscription Active')).toBeTruthy();
      expect(getByText('basic, extras')).toBeTruthy();
      expect(container.textContent).toContain('Entitlements: basic, extras');
      expect(container.textContent).toContain(
        `Subscribed since: ${new Date(
          '2026-01-15T00:00:00.000Z'
        ).toLocaleDateString()}`
      );
      expect(container.textContent).toContain(
        'Your subscription was purchased on Web. To manage your subscription, please visit your Web settings.'
      );
      expect(queryByTestId('segmented-control')).toBeNull();
      expect(queryByTestId('free-tile')).toBeNull();

      await firePress(getByText('Manage Subscription'));
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://billing.example.com/manage'
      );
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
        givenOfferings();
        givenPackages();
        givenSubscription();
        mockUseBackendSubscription.mockReturnValue({
          data: { platform: backendPlatform, entitlements: ['basic'] },
          isLoading: false,
          error: null,
        });

        const { queryByText, getByTestId } = await render(
          <SubscriptionByOfferPage
            onNavigateToLogin={() => {}}
            {...backendConfig}
          />
        );

        // No `currentPlatform` passed: the page reads the running platform.
        expect(queryByText('Subscription Active')).toBeNull();
        expect(getByTestId('segmented-control')).toBeTruthy();
      }
    );

    it('lets the app name the current platform', async () => {
      givenOfferings();
      givenPackages();
      givenSubscription();
      mockUseBackendSubscription.mockReturnValue({
        data: { platform: 'ios', entitlements: ['basic'] },
        isLoading: false,
        error: null,
      });

      const { getByText } = await render(
        <SubscriptionByOfferPage
          onNavigateToLogin={() => {}}
          currentPlatform={'android' as any}
          {...backendConfig}
        />
      );

      expect(getByText('Subscription Active')).toBeTruthy();
      expect(getByText('iOS')).toBeTruthy();
    });

    it('refetches offerings that came back empty once the user has settled', async () => {
      givenOfferings([]);
      givenPackages();
      givenSubscription();

      await render(
        <SubscriptionByOfferPage onNavigateToLogin={() => {}} userId='user-1' />
      );

      expect(refetchOfferings).toHaveBeenCalledTimes(1);
    });

    it('does not refetch offerings that loaded, failed, or are still waiting on the user', async () => {
      givenPackages();

      givenOfferings();
      givenSubscription();
      const loaded = await render(
        <SubscriptionByOfferPage onNavigateToLogin={() => {}} userId='user-1' />
      );
      loaded.unmount();

      givenOfferings([], { error: new Error('offline') });
      const failed = await render(
        <SubscriptionByOfferPage onNavigateToLogin={() => {}} userId='user-1' />
      );
      failed.unmount();

      givenOfferings([]);
      givenSubscription(null, { isLoading: true });
      await render(
        <SubscriptionByOfferPage onNavigateToLogin={() => {}} userId='user-1' />
      );

      expect(refetchOfferings).not.toHaveBeenCalled();
    });
  });
});
