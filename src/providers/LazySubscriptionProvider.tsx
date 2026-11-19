/**
 * Lazy Subscription Provider (React Native)
 *
 * RN mirror of @sudobility/subscription_pages' LazySubscriptionProvider: for
 * unauthenticated users it provides a stub context; for authenticated users it
 * mounts the real subscription provider and points RevenueCat at `entityId`.
 *
 * What is NOT mirrored is the code-splitting the web version is named after.
 * There, `React.lazy` keeps the RevenueCat web SDK (~600KB) in its own chunk.
 * A Metro bundle has no chunks to defer, and the RN adapter already `require`s
 * react-native-purchases on first use, so the wrapper is imported directly.
 * The name is kept so both packages expose the same provider.
 *
 * Exported from `@sudobility/subscription_pages_rn/firebase`, not the package
 * root: it reads the signed-in user from @sudobility/auth_lib (Firebase auth),
 * which not every consuming app installs, and Metro bundles everything a
 * barrel imports.
 */

import { type ReactNode } from 'react';
import { useIsLoggedIn } from '@sudobility/auth_lib/auth-js';
import {
  SafeSubscriptionContext,
  STUB_SUBSCRIPTION_VALUE,
} from './SafeSubscriptionContext';
import { SubscriptionProviderWrapper } from './SubscriptionProviderWrapper';

function StubSubscriptionProvider({ children }: { children: ReactNode }) {
  return (
    <SafeSubscriptionContext.Provider value={STUB_SUBSCRIPTION_VALUE}>
      {children}
    </SafeSubscriptionContext.Provider>
  );
}

export interface LazySubscriptionProviderProps {
  children: ReactNode;
  /** Entity ID to use as RevenueCat subscriber */
  entityId?: string;
  /** RevenueCat API key */
  apiKey: string;
}

/**
 * Wrapper for SubscriptionProvider that only mounts it when the user is
 * authenticated. For unauthenticated users, provides a stub context so hooks
 * don't throw.
 */
export function LazySubscriptionProvider({
  children,
  entityId,
  apiKey,
}: LazySubscriptionProviderProps) {
  const isAuthenticated = useIsLoggedIn();

  if (!isAuthenticated) {
    return <StubSubscriptionProvider>{children}</StubSubscriptionProvider>;
  }

  return (
    <SubscriptionProviderWrapper entityId={entityId} apiKey={apiKey}>
      {children}
    </SubscriptionProviderWrapper>
  );
}

export default LazySubscriptionProvider;
