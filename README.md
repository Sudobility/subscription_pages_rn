# @sudobility/subscription_pages_rn

React Native subscription page components. Provides ready-to-use screens for
choosing subscription plans grouped by billing duration or by offering, plus the
React Native RevenueCat adapter and a safe subscription context. This is the
React Native counterpart of the web package `@sudobility/subscription_pages`.

Data/business logic comes from `@sudobility/subscription_lib` (hooks + singleton
service); UI tiles come from `@sudobility/components-rn/subscription`. Styling is
NativeWind (Tailwind `className` props), not RN `StyleSheet`.

It mirrors the web package: the same exports under the same names, the same
props, sections, wording and logic. The deliberate differences are listed in
`CLAUDE.md` ("Mirror of `@sudobility/subscription_pages`").

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

Metro loads this package from `src/` (the `react-native` export condition), so
the app's NativeWind/Babel setup compiles its `className`s. Add it to the app's
`tailwind.config.js` `content`, or its classes are never generated and the pages
render unstyled:

```js
'./node_modules/@sudobility/subscription_pages_rn/{src,dist}/**/*.{js,jsx,ts,tsx}',
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

`currentPlatform` defaults to the platform the app is running on (`Platform.OS`:
iOS, Android, macOS; Windows bills as Web) — the counterpart of the web page's
`Web` default.

### RevenueCat adapter

`configureRevenueCatRNAdapter`, `createRevenueCatRNAdapter`,
`setRevenueCatRNUser`, `clearRevenueCatRNUser`, `hasRevenueCatRNUser` — the React
Native (`react-native-purchases`) implementation of `subscription_lib`'s
`SubscriptionAdapter` seam. The SDK is loaded lazily, so it does nothing (warns)
if `react-native-purchases` is not installed.

The same five functions are also exported under the web package's names —
`configureRevenueCatAdapter`, `createRevenueCatAdapter`, `setRevenueCatUser`,
`clearRevenueCatUser`, `hasRevenueCatUser` — so code written against
`@sudobility/subscription_pages` imports them unchanged. They are this package's
React Native adapter.

### Safe subscription context

`SafeSubscriptionContext`, `useSafeSubscription`, `STUB_SUBSCRIPTION_VALUE`,
`SubscriptionContextValue` — a context with safe defaults, so consumers never
crash or get null when no provider wraps the tree. The value is the
`SubscriptionContextValue` of `@sudobility/components-rn/subscription`
(`products`, `currentSubscription`, `isLoading`, `error`, `initialize`,
`purchase`, `restore`, `refresh`, `clearError`) — the same shape the web package
uses; the stub has no products and no-op actions.

### `LazySubscriptionProvider` (`/firebase`)

```tsx
import { LazySubscriptionProvider } from '@sudobility/subscription_pages_rn/firebase';

<LazySubscriptionProvider apiKey={REVENUECAT_API_KEY} entityId={entityId}>
  <App />
</LazySubscriptionProvider>;
```

Same props and behaviour as the web export of that name: a signed-out (or
anonymous) user gets the stub context; a signed-in user gets the subscription
provider, and `entityId` becomes the RevenueCat user. It reads the user from
`@sudobility/auth_lib` (Firebase auth), so it sits behind the `/firebase` entry
rather than the package root — apps without auth_lib can still bundle the root.
There is no lazy chunk on React Native; the name is kept for parity.

### Peer dependencies

| Package | Version | Notes |
|---------|---------|-------|
| `react` | >=18 | |
| `react-native` | >=0.74 | |
| `react-native-purchases` | >=7.0.0 | **Optional** — only needed if you use the RevenueCat adapter. |
| `@sudobility/subscription_lib` | see `package.json` | Hooks + singleton service. |
| `@sudobility/components-rn` | see `package.json` | UI tiles (`@sudobility/components-rn/subscription`). |
| `@sudobility/types` | see `package.json` | Shared types. |
| `@sudobility/design` | see `package.json` | Design tokens. |
| `@sudobility/auth_lib` | see `package.json` | **Optional** — only for the `/firebase` entry. |
| `@sudobility/di` | see `package.json` | **Optional** — only for the `/firebase` entry. |

## Development

```bash
bun run build         # tsc (tsconfig.build.json) → dist/, then fix ESM import paths
bun run typecheck     # tsc --noEmit
bun run lint          # ESLint (max-warnings 0)
bun run lint:fix      # ESLint with --fix
bun run format        # Prettier write (src)
bun run format:check  # Prettier check (src)
bun run test:unit     # Vitest (jsdom, react-native aliased to a DOM mock)
bun run verify        # typecheck + lint + format:check + test:unit + build
```

There is no `test` script; never run `bun test` (Bun's own runner). `src/index.ts`
is the barrel entry; the build emits declarations + JS to `dist/`, and
`scripts/fix-esm-imports.mjs` rewrites relative imports to fully-qualified paths
so Node's native ESM loader can resolve them.

## License

BUSL-1.1
