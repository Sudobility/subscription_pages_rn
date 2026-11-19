/**
 * The subscription providers: the safe context (root export) and
 * LazySubscriptionProvider (`/firebase` export). Both follow
 * @sudobility/subscription_pages — the same context value, the same stub, the
 * same auth gate and the same RevenueCat-user bridge.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SafeSubscriptionContext,
  STUB_SUBSCRIPTION_VALUE,
  useSafeSubscription,
} from '../providers';
import { LazySubscriptionProvider } from '../firebase';
import { render, flushPromises } from './test-utils';

const mocks = vi.hoisted(() => {
  const context = {
    products: [{ identifier: 'pro_monthly' }],
    currentSubscription: null,
    isLoading: false,
    error: null,
    initialize: vi.fn(() => Promise.resolve()),
    purchase: vi.fn(() => Promise.resolve(true)),
    restore: vi.fn(() => Promise.resolve(true)),
    refresh: vi.fn(() => Promise.resolve()),
    clearError: vi.fn(),
  };
  return {
    context,
    useIsLoggedIn: vi.fn(),
    useAuthUser: vi.fn(),
    providerProps: vi.fn(),
    refreshSubscription: vi.fn(),
    setRevenueCatRNUser: vi.fn(),
    clearRevenueCatRNUser: vi.fn(),
    getInfoService: vi.fn(),
    show: vi.fn(),
  };
});

vi.mock('@sudobility/auth_lib/auth-js', () => ({
  useIsLoggedIn: () => mocks.useIsLoggedIn(),
  useAuthUser: () => mocks.useAuthUser(),
}));

vi.mock('@sudobility/components-rn/subscription', () => ({
  SubscriptionProvider: (props: any) => {
    mocks.providerProps(props);
    return props.children;
  },
  useSubscriptionContext: () => mocks.context,
}));

vi.mock('@sudobility/subscription_lib', () => ({
  refreshSubscription: () => mocks.refreshSubscription(),
}));

vi.mock('@sudobility/di/info', () => ({
  getInfoService: () => mocks.getInfoService(),
}));

vi.mock('../adapters', () => ({
  setRevenueCatRNUser: (...args: unknown[]) =>
    mocks.setRevenueCatRNUser(...args),
  clearRevenueCatRNUser: () => mocks.clearRevenueCatRNUser(),
}));

const realUser = {
  uid: 'uid-1',
  email: 'ada@example.com',
  displayName: 'Ada',
  photoURL: null,
  isAnonymous: false,
};

/** Reports which subscription value reaches a consumer. */
function Probe() {
  const value = useSafeSubscription();
  const which =
    value === STUB_SUBSCRIPTION_VALUE
      ? 'stub'
      : value === mocks.context
        ? 'provider'
        : 'other';
  return <span data-testid='probe'>{which}</span>;
}

function givenSignedIn(user: typeof realUser | null = realUser) {
  mocks.useIsLoggedIn.mockReturnValue(!!user && !user.isAnonymous);
  mocks.useAuthUser.mockReturnValue(user);
}

describe('SafeSubscriptionContext', () => {
  it('hands a consumer the stub when no provider is mounted', async () => {
    const { getByTestId } = await render(<Probe />);
    expect(getByTestId('probe').textContent).toBe('stub');
  });

  it('stubs the value the subscription provider publishes', async () => {
    // The shape @sudobility/subscription_pages stubs on the web.
    expect(Object.keys(STUB_SUBSCRIPTION_VALUE).sort()).toEqual([
      'clearError',
      'currentSubscription',
      'error',
      'initialize',
      'isLoading',
      'products',
      'purchase',
      'refresh',
      'restore',
    ]);
    expect(STUB_SUBSCRIPTION_VALUE.products).toEqual([]);
    expect(STUB_SUBSCRIPTION_VALUE.currentSubscription).toBeNull();
    expect(STUB_SUBSCRIPTION_VALUE.isLoading).toBe(false);
    expect(STUB_SUBSCRIPTION_VALUE.error).toBeNull();
    await expect(STUB_SUBSCRIPTION_VALUE.initialize()).resolves.toBeUndefined();
    await expect(STUB_SUBSCRIPTION_VALUE.purchase('pro')).resolves.toBe(false);
    await expect(STUB_SUBSCRIPTION_VALUE.restore()).resolves.toBe(false);
    await expect(STUB_SUBSCRIPTION_VALUE.refresh()).resolves.toBeUndefined();
    expect(STUB_SUBSCRIPTION_VALUE.clearError()).toBeUndefined();
  });

  it('hands a consumer whatever a provider supplies', async () => {
    const { getByTestId } = await render(
      <SafeSubscriptionContext.Provider value={mocks.context as any}>
        <Probe />
      </SafeSubscriptionContext.Provider>
    );
    expect(getByTestId('probe').textContent).toBe('provider');
  });
});

describe('LazySubscriptionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setRevenueCatRNUser.mockResolvedValue(undefined);
    mocks.clearRevenueCatRNUser.mockResolvedValue(undefined);
    mocks.getInfoService.mockReturnValue({ show: mocks.show });
  });

  it('provides the stub and mounts nothing for a signed-out user', async () => {
    givenSignedIn(null);

    const { getByTestId } = await render(
      <LazySubscriptionProvider apiKey='rc_key' entityId='entity-1'>
        <Probe />
      </LazySubscriptionProvider>
    );

    expect(getByTestId('probe').textContent).toBe('stub');
    expect(mocks.providerProps).not.toHaveBeenCalled();
    expect(mocks.setRevenueCatRNUser).not.toHaveBeenCalled();
  });

  it('provides the stub for an anonymous user', async () => {
    givenSignedIn({ ...realUser, isAnonymous: true });

    const { getByTestId } = await render(
      <LazySubscriptionProvider apiKey='rc_key' entityId='entity-1'>
        <Probe />
      </LazySubscriptionProvider>
    );

    expect(getByTestId('probe').textContent).toBe('stub');
    expect(mocks.providerProps).not.toHaveBeenCalled();
  });

  it('mounts the subscription provider and makes the entity the RevenueCat user', async () => {
    givenSignedIn();

    const { getByTestId } = await render(
      <LazySubscriptionProvider apiKey='rc_key' entityId='entity-1'>
        <Probe />
      </LazySubscriptionProvider>
    );
    await flushPromises();

    expect(getByTestId('probe').textContent).toBe('provider');
    expect(mocks.providerProps).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'rc_key',
        userEmail: 'ada@example.com',
        onError: expect.any(Function),
      })
    );
    // The subscriber is the entity, not the Firebase uid.
    expect(mocks.context.initialize).toHaveBeenCalledWith(
      'entity-1',
      'ada@example.com'
    );
    expect(mocks.setRevenueCatRNUser).toHaveBeenCalledWith(
      'entity-1',
      'ada@example.com'
    );
    // subscription_lib reloads only after the user is in place.
    expect(mocks.refreshSubscription).toHaveBeenCalledTimes(1);
  });

  it('sets the user once for an unchanged entity', async () => {
    givenSignedIn();
    const tree = (
      <LazySubscriptionProvider apiKey='rc_key' entityId='entity-1'>
        <Probe />
      </LazySubscriptionProvider>
    );

    const { rerender } = await render(tree);
    await rerender(tree);
    await flushPromises();

    expect(mocks.context.initialize).toHaveBeenCalledTimes(1);
    expect(mocks.setRevenueCatRNUser).toHaveBeenCalledTimes(1);
  });

  it('passes no email for a user without one', async () => {
    givenSignedIn({ ...realUser, email: null as any });

    await render(
      <LazySubscriptionProvider apiKey='rc_key' entityId='entity-1'>
        <Probe />
      </LazySubscriptionProvider>
    );

    expect(mocks.providerProps).toHaveBeenCalledWith(
      expect.objectContaining({ userEmail: undefined })
    );
    expect(mocks.context.initialize).toHaveBeenCalledWith(
      'entity-1',
      undefined
    );
    expect(mocks.setRevenueCatRNUser).toHaveBeenCalledWith(
      'entity-1',
      undefined
    );
  });

  it('sets no RevenueCat user until there is an entity', async () => {
    givenSignedIn();

    const { getByTestId } = await render(
      <LazySubscriptionProvider apiKey='rc_key'>
        <Probe />
      </LazySubscriptionProvider>
    );

    expect(getByTestId('probe').textContent).toBe('provider');
    expect(mocks.context.initialize).not.toHaveBeenCalled();
    expect(mocks.setRevenueCatRNUser).not.toHaveBeenCalled();
    expect(mocks.clearRevenueCatRNUser).not.toHaveBeenCalled();
  });

  it('clears the RevenueCat user when the entity goes away', async () => {
    givenSignedIn();

    const { rerender } = await render(
      <LazySubscriptionProvider apiKey='rc_key' entityId='entity-1'>
        <Probe />
      </LazySubscriptionProvider>
    );
    await flushPromises();
    expect(mocks.clearRevenueCatRNUser).not.toHaveBeenCalled();

    await rerender(
      <LazySubscriptionProvider apiKey='rc_key'>
        <Probe />
      </LazySubscriptionProvider>
    );

    expect(mocks.clearRevenueCatRNUser).toHaveBeenCalledTimes(1);
  });

  it('switches the RevenueCat user when the entity changes', async () => {
    givenSignedIn();

    const { rerender } = await render(
      <LazySubscriptionProvider apiKey='rc_key' entityId='entity-1'>
        <Probe />
      </LazySubscriptionProvider>
    );
    await rerender(
      <LazySubscriptionProvider apiKey='rc_key' entityId='entity-2'>
        <Probe />
      </LazySubscriptionProvider>
    );
    await flushPromises();

    expect(mocks.setRevenueCatRNUser).toHaveBeenLastCalledWith(
      'entity-2',
      'ada@example.com'
    );
    expect(mocks.refreshSubscription).toHaveBeenCalledTimes(2);
  });

  it('reports a failed RevenueCat login through the info service', async () => {
    givenSignedIn();
    mocks.setRevenueCatRNUser.mockRejectedValue(new Error('logIn failed'));

    await render(
      <LazySubscriptionProvider apiKey='rc_key' entityId='entity-1'>
        <Probe />
      </LazySubscriptionProvider>
    );
    await flushPromises();

    expect(mocks.show).toHaveBeenCalledWith(
      'Subscription Error',
      'logIn failed',
      'error',
      5000
    );
    expect(mocks.refreshSubscription).not.toHaveBeenCalled();
  });

  it('reports provider errors through the info service, or the console without one', async () => {
    givenSignedIn();

    await render(
      <LazySubscriptionProvider apiKey='rc_key' entityId='entity-1'>
        <Probe />
      </LazySubscriptionProvider>
    );
    const { onError } = mocks.providerProps.mock.lastCall?.[0] as {
      onError: (error: Error) => void;
    };

    onError(new Error('Purchase failed'));
    expect(mocks.show).toHaveBeenCalledWith(
      'Subscription Error',
      'Purchase failed',
      'error',
      5000
    );

    // No info service registered: the error is still surfaced.
    mocks.getInfoService.mockImplementation(() => {
      throw new Error('Info service not initialized');
    });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    onError(new Error('Restore failed'));
    expect(consoleError).toHaveBeenCalledWith(
      '[Subscription]',
      'Restore failed'
    );
  });
});
