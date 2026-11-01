import { View, Text, Pressable, Linking } from 'react-native';
import type {
  SubscriptionPlatform,
  BackendSubscriptionResult,
} from '@sudobility/types';

const PLATFORM_NAMES: Record<string, string> = {
  web: 'Web',
  ios: 'iOS',
  android: 'Android',
  macos: 'macOS',
};

export interface CrossPlatformSubscriptionInfoProps {
  backendSubscription: BackendSubscriptionResult;
  managementUrl?: string;
  currentPlatform: SubscriptionPlatform;
}

export function CrossPlatformSubscriptionInfo({
  backendSubscription,
  managementUrl,
}: CrossPlatformSubscriptionInfoProps) {
  const platformName = backendSubscription.platform
    ? (PLATFORM_NAMES[backendSubscription.platform] ??
      backendSubscription.platform)
    : 'another platform';

  return (
    <View className='rounded-xl border border-warning/20 bg-warning/10 p-6 items-center gap-4'>
      <Text className='text-lg font-semibold text-foreground'>
        Subscription Active
      </Text>

      <View className='gap-2 items-center'>
        <Text className='text-sm text-foreground'>
          Entitlements:{' '}
          <Text className='font-medium'>
            {backendSubscription.entitlements.join(', ')}
          </Text>
        </Text>
        {backendSubscription.subscriptionStartedAt && (
          <Text className='text-sm text-foreground'>
            Subscribed since:{' '}
            <Text className='font-medium'>
              {new Date(
                backendSubscription.subscriptionStartedAt
              ).toLocaleDateString()}
            </Text>
          </Text>
        )}
      </View>

      <Text className='text-sm text-warning text-center'>
        Your subscription was purchased on{' '}
        <Text className='font-semibold'>{platformName}</Text>. To manage your
        subscription, please visit your {platformName} settings.
      </Text>

      {managementUrl && (
        <Pressable
          onPress={() => Linking.openURL(managementUrl)}
          accessibilityRole='button'
          className='rounded-lg px-5 py-2.5 bg-primary items-center'
        >
          <Text className='text-sm font-semibold text-primary-foreground'>
            Manage Subscription
          </Text>
        </Pressable>
      )}
    </View>
  );
}
