/**
 * Subscription Provider Wrapper (React Native)
 *
 * Integrates subscription-components with auth and sets up RevenueCat user.
 * RN mirror of @sudobility/subscription_pages' SubscriptionProviderWrapper:
 * the same bridge, over @sudobility/components-rn/subscription and this
 * package's React Native RevenueCat adapter.
 */

import { type ReactNode, useEffect, useRef } from 'react';
import {
  SubscriptionProvider,
  useSubscriptionContext,
} from '@sudobility/components-rn/subscription';
import { useAuthUser } from '@sudobility/auth_lib/auth-js';
import { getInfoService } from '@sudobility/di/info';
import { InfoType } from '@sudobility/types';
// refreshSubscription is agnostic business logic (subscription_lib); the
// RevenueCat user setters are this package's own RN adapter functions.
import { refreshSubscription } from '@sudobility/subscription_lib';
import { setRevenueCatRNUser, clearRevenueCatRNUser } from '../adapters';
import { SafeSubscriptionContext } from './SafeSubscriptionContext';

interface SubscriptionProviderWrapperProps {
  children: ReactNode;
  entityId?: string;
  apiKey: string;
}

const handleSubscriptionError = (error: Error) => {
  try {
    getInfoService().show(
      'Subscription Error',
      error.message,
      InfoType.ERROR,
      5000
    );
  } catch {
    // InfoService not available - log to console
    console.error('[Subscription]', error.message);
  }
};

/**
 * Bridge that provides context and configures RevenueCat user.
 */
function SubscriptionBridge({
  children,
  entityId,
}: {
  children: ReactNode;
  entityId?: string;
}) {
  const user = useAuthUser();
  const context = useSubscriptionContext();
  const entityIdRef = useRef<string | null>(null);

  useEffect(() => {
    const shouldSetUser = user && !user.isAnonymous && entityId;

    if (shouldSetUser && entityId !== entityIdRef.current) {
      entityIdRef.current = entityId;
      // Set user for both subscription-components and subscription_lib
      context.initialize(entityId, user.email || undefined);
      setRevenueCatRNUser(entityId, user.email || undefined)
        .then(() => {
          // Refresh subscription_lib data after user is set
          refreshSubscription();
        })
        .catch((error: unknown) => {
          // The native SDK's logIn can reject (the web SDK's configure does
          // not); report it the way every other subscription error is.
          handleSubscriptionError(
            error instanceof Error
              ? error
              : new Error('Failed to set subscription user')
          );
        });
    } else if (!shouldSetUser && entityIdRef.current) {
      entityIdRef.current = null;
      void clearRevenueCatRNUser();
    }
  }, [user, entityId, context]);

  return (
    <SafeSubscriptionContext.Provider value={context}>
      {children}
    </SafeSubscriptionContext.Provider>
  );
}

export function SubscriptionProviderWrapper({
  children,
  entityId,
  apiKey,
}: SubscriptionProviderWrapperProps) {
  const user = useAuthUser();

  return (
    <SubscriptionProvider
      apiKey={apiKey}
      userEmail={user?.email || undefined}
      onError={handleSubscriptionError}
    >
      <SubscriptionBridge entityId={entityId}>{children}</SubscriptionBridge>
    </SubscriptionProvider>
  );
}

export default SubscriptionProviderWrapper;
