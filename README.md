# @sudobility/subscription_pages_rn

React Native subscription page components. Provides ready-to-use screens for
choosing subscription plans grouped by billing duration or by offering, plus the
React Native RevenueCat adapter and a safe subscription context. This is the
React Native counterpart of the web package `@sudobility/subscription_pages`.

Data/business logic comes from `@sudobility/subscription_lib` (hooks + singleton
service); UI tiles come from `@sudobility/components-rn/subscription`. Styling is
NativeWind (Tailwind `className` props), not RN `StyleSheet`.

## Installation

This package is published to **GitHub Packages** under the `@sudobility` scope.
A project-local `.npmrc` must route the scope to the GitHub registry:

```
@sudobility:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GH_PACKAGES_READ_TOKEN}
```

Then install (the repo uses **Bun**, never npm):

```bash
bun add @sudobility/subscription_pages_rn
```

## Usage

```tsx
import {
  SubscriptionByDurationPage,
  SubscriptionByOfferPage,
} from '@sudobility/subscription_pages_rn';

// Plans grouped by billing period (monthly, yearly, …) with a SegmentedControl
<SubscriptionByDurationPage
  onNavigateToLogin={(offerId, packageId) => navigation.navigate('Login')}
  userId={user?.uid}
  userEmail={user?.email}
  featuresByPackage={{
    pro_monthly: ['Unlimited access', 'Priority support'],
    pro_yearly: ['Unlimited access', 'Priority support', 'Early features'],
  }}
  freeFeatures={['Basic access', '5 items per month']}
/>

// Plans grouped by offering, with a Free tab
<SubscriptionByOfferPage
  onNavigateToLogin={(offerId, packageId) => navigation.navigate('Login')}
  userId={user?.uid}
  userEmail={user?.email}
  freeFeatures={['3 items', 'Community support']}
  renderOfferingContent={offerId => <OfferingBlurb id={offerId} />}
/>
```

The RevenueCat adapter must be registered with `subscription_lib` once at app
startup, before any page renders:

```ts
import {
  configureRevenueCatRNAdapter,
  createRevenueCatRNAdapter,
} from '@sudobility/subscription_pages_rn';
import { initializeSubscription } from '@sudobility/subscription_lib';

configureRevenueCatRNAdapter(REVENUECAT_API_KEY);
initializeSubscription({
  adapter: createRevenueCatRNAdapter({ usesNativeIap: true }),
});
```

## API

### Pages

| Component | Description |
|-----------|-------------|
| `SubscriptionByDurationPage` | Packages grouped by billing period, switched via a `SegmentedControl`. |
| `SubscriptionByOfferPage` | Packages grouped by offering, with a Free tab and per-offering savings. |

Both pages share the same core props. The only required prop is
`onNavigateToLogin`; `userId` is **optional** (undefined = logged-out / anonymous
web billing). Key props: `onNavigateToLogin` (required), `userId?`, `userEmail?`,
`featuresByPackage?`, `freeFeatures?`, `title?`, `className?`, `currentPlatform?`,
`networkClient?` / `baseUrl?` / `token?` / `testMode?` (backend subscription
lookup for cross-platform detection), and `t?` (translation fn). The Duration
page also accepts `getFeaturesByPackageId?` / `getFeaturesByEntitlement?`; the
Offer page also accepts `renderOfferingContent?` and `initialOfferId?`. See the
`...Props` interfaces exported alongside each component for the full list.

### RevenueCat adapter

`configureRevenueCatRNAdapter`, `createRevenueCatRNAdapter`,
`setRevenueCatRNUser`, `clearRevenueCatRNUser`, `hasRevenueCatRNUser` — the React
Native (`react-native-purchases`) implementation of `subscription_lib`'s
`SubscriptionAdapter` seam. The SDK is loaded lazily, so it does nothing (warns)
if `react-native-purchases` is not installed.

### Safe subscription context

`SafeSubscriptionContext`, `useSafeSubscription`, `STUB_SUBSCRIPTION_VALUE`,
`SubscriptionContextValue` — a context that returns a stub (`isSubscribed:
false`) when no provider wraps the tree, so consumers never crash or get null.

### Peer dependencies

| Package | Version | Notes |
|---------|---------|-------|
| `react` | >=18 | |
| `react-native` | >=0.74 | |
| `react-native-purchases` | >=7.0.0 | **Optional** — only needed if you use the RevenueCat adapter. |
| `@sudobility/subscription_lib` | ^0.0.65 | Hooks + singleton service. |
| `@sudobility/components-rn` | ^1.0.150 | UI tiles (`@sudobility/components-rn/subscription`). |
| `@sudobility/types` | ^1.9.78 | Shared types. |
| `@sudobility/design` | ^1.1.69 | Design tokens. |

## Development

```bash
bun run build         # tsc (tsconfig.build.json) → dist/, then fix ESM import paths
bun run typecheck     # tsc --noEmit
bun run lint          # ESLint (max-warnings 0)
bun run lint:fix      # ESLint with --fix
bun run format        # Prettier write (src)
bun run format:check  # Prettier check (src)
```

There are no tests in this package. `src/index.ts` is the barrel entry; the build
emits declarations + JS to `dist/`, and `scripts/fix-esm-imports.mjs` rewrites
relative imports to fully-qualified paths so Node's native ESM loader can resolve
them.

## License

BUSL-1.1
