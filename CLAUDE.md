# subscription_pages_rn - AI Development Guide

> **Git policy — never auto-commit or auto-push.** Leave your work in the working tree.
> Run `git commit`, `git push`, `gh pr create`, or `scripts/push_all.sh` **only when the user
> explicitly asks in that turn**. Approval for an earlier change does not carry forward, and
> finishing a task is not permission to commit it.
> Do not use feature branches — stay on the current branch.

## Overview

React Native subscription page components. Ready-to-use screens for choosing
plans grouped by duration (billing period) or by offer (product catalog), plus
the RevenueCat RN adapter and a safe subscription context. Faithful RN mirror of
the web `@sudobility/subscription_pages`.

- **Package**: `@sudobility/subscription_pages_rn`, BUSL-1.1 (version: see `package.json`)
- **Package manager**: Bun (never npm). `type: module` (ESM).
- **TypeScript**: ~6.0.x, target ES2020, `moduleResolution: bundler`, strict.
- **Build output**: `dist/` (declarations + JS). Library only — no app.
- **Tests**: Vitest (jsdom); `react-native` is aliased to a DOM mock
  (`src/__tests__/mocks/react-native.ts`).
- **Published to GitHub Packages** under the `@sudobility` scope — see `.npmrc`
  (`@sudobility:registry=https://npm.pkg.github.com`). Install needs a GitHub
  token (`GH_PACKAGES_READ_TOKEN`).

## Commands

```bash
bun run build         # bunx tsc -p tsconfig.build.json → dist/, then scripts/fix-esm-imports.mjs
bun run typecheck     # bunx tsc --noEmit
bun run lint          # eslint . (flat config, --max-warnings 0)
bun run lint:fix
bun run format        # prettier --write src
bun run format:check
bun run test:unit     # vitest run   (NOT `bun test` — that is Bun's own runner)
bun run verify        # typecheck + lint + format:check + test:unit + build
```

`fix-esm-imports.mjs` rewrites emitted relative imports to fully-qualified paths
(`./core` → `./core/index.js`) so Node's native ESM loader can resolve tsc's
`bundler`-style output. Must run after every build; it is idempotent.

## Structure

```
src/
├── index.ts                 # Root barrel: pages, adapter, safe context
├── firebase.ts              # `/firebase` entry: LazySubscriptionProvider (needs auth_lib)
├── nativewind.d.ts          # Augments RN props with `className` for NativeWind
├── pages/
│   ├── SubscriptionByDurationPage.tsx
│   ├── SubscriptionByOfferPage.tsx
│   └── currentPlatform.ts           # Platform.OS → SubscriptionPlatform (the default)
├── adapters/revenuecat-rn.ts        # SubscriptionAdapter impl (react-native-purchases)
├── providers/
│   ├── SafeSubscriptionContext.tsx
│   ├── LazySubscriptionProvider.tsx     # auth gate; exported from `/firebase` only
│   └── SubscriptionProviderWrapper.tsx  # NOT exported — used by the above
├── components/CrossPlatformSubscriptionInfo.tsx
└── __tests__/               # vitest specs + RN mock + setup (excluded from build)
```

Every file has a twin of the same name in `@sudobility/subscription_pages`
(`revenuecat-rn.ts` ↔ `revenuecat-web.ts`); `currentPlatform.ts` and `firebase.ts`
are the only RN-only source files.

## Key Exports

Root (`src/index.ts`):

- `SubscriptionByDurationPage` / `SubscriptionByOfferPage` (+ their `...Props`).
- Adapter: `configureRevenueCatRNAdapter`, `createRevenueCatRNAdapter`,
  `setRevenueCatRNUser`, `clearRevenueCatRNUser`, `hasRevenueCatRNUser`,
  `RevenueCatRNAdapterOptions` — and the same five functions under the web
  package's names (`configureRevenueCatAdapter`, `createRevenueCatAdapter`,
  `setRevenueCatUser`, `clearRevenueCatUser`, `hasRevenueCatUser`). The aliases
  are the RN adapter, not the web one.
- Context: `SafeSubscriptionContext`, `useSafeSubscription`,
  `STUB_SUBSCRIPTION_VALUE`, `SubscriptionContextValue` (the type
  `@sudobility/components-rn/subscription` publishes — same shape as the web).

`@sudobility/subscription_pages_rn/firebase` (`src/firebase.ts`):

- `LazySubscriptionProvider` (+ `LazySubscriptionProviderProps`) — same props
  (`apiKey`, `entityId?`, `children`) and behaviour as the web export of that name.

## Mirror of `@sudobility/subscription_pages` — what differs, and why

Keep everything else identical: props, sections, wording, fallback strings, the
hooks called and their arguments. Change the web page and this one together.

| Web | Here | Why |
|-----|------|-----|
| `LazySubscriptionProvider` exported from the root | exported from `/firebase` | It imports `@sudobility/auth_lib`. Metro bundles everything a barrel imports (no tree-shaking), so a root export would stop apps without auth_lib (mail_box_rn) from bundling. `exports.test.ts` guards this. |
| `React.lazy` + `Suspense` around the provider wrapper | direct import | Code-splitting the ~600KB RevenueCat **web** SDK is a web bundle concern; the RN adapter already `require`s the native SDK on first use. |
| `currentPlatform` defaults to `Web` | defaults to the running platform (`Platform.OS`) | Same rule — "the platform I am on" — on a package that runs on four of them. |
| `window.open(managementUrl)` / `<a href>` | `Linking.openURL(managementUrl)` | RN idiom. |
| Backend subscription fetched whenever config + `userId` are present | additionally requires `useIsUserSubscribable()` and passes `nativeIap` | Native IAP exists only here; an anonymous web-billing guest is rejected by the backend, so the request is skipped. |
| Adapter can load offerings with no user | pages refetch once the user settles (see Gotchas) | The RN adapter returns no offerings until an app-user id is set. |
| Content fades in on segment switch (Web Animations API) | no animation | Not ported. |
| Duration page hard-codes some English labels | every label goes through `t` | Superset; the fallbacks are the web's strings. |

## Peer dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` / `react-native` | >=18 / >=0.74 | framework |
| `react-native-purchases` | >=7.0.0 | **optional** — RevenueCat SDK, only for the adapter |
| `@sudobility/subscription_lib` | see `package.json` | hooks + singleton service (`getSubscriptionInstance`, `refreshSubscription`) |
| `@sudobility/components-rn` | see `package.json` | UI tiles + `SubscriptionProvider` via `@sudobility/components-rn/subscription` |
| `@sudobility/types` | see `package.json` | shared types (`SubscriptionPlatform`, `SubscriptionPeriod`, `NetworkClient`) |
| `@sudobility/design` | see `package.json` | design tokens |
| `@sudobility/auth_lib` | see `package.json` | **optional** — only for `/firebase` (`useIsLoggedIn`, `useAuthUser`) |
| `@sudobility/di` | see `package.json` | **optional** — only for `/firebase` (`getInfoService`, to report errors) |

## How an app consumes it (read this before touching packaging)

Metro reads the package from **`src/`**, not `dist/`: `package.json` has
`"react-native": "src/index.ts"` and a `react-native` condition on both `exports`
entries (`.` and `./firebase`). That is what makes `className` work — NativeWind
styles JSX only when the **app's** Babel preset compiles it. Precompiled `dist/`
calls `react/jsx-runtime` directly, so every `className` on a `View`/`Text`/
`Pressable` would be ignored and the page would render as unstyled text. `dist/`
is for types and non-Metro tooling. `src/` must therefore stay in the published
package, and the app must list
`./node_modules/@sudobility/subscription_pages_rn/{src,dist}/**/*.{js,jsx,ts,tsx}`
in its `tailwind.config.js` `content`, or the classes are never generated.

## Architecture & conventions

- **Adapter seam.** RN-specific RevenueCat code lives here, NOT in
  `subscription_lib`, so the platform-agnostic lib never pulls in
  `react-native-purchases`. App injects it at startup:
  `initializeSubscription({ adapter: createRevenueCatRNAdapter({ usesNativeIap }) })`.
  The SDK is `require`d lazily; absent SDK → warn + no-op, never crash.
- **Styling is NativeWind** (`className` props), NOT RN `StyleSheet`. Page-level
  JSX uses Tailwind classes; `nativewind.d.ts` adds `className` to RN prop types.
  `cn` / `pressProps` come from `@sudobility/components-rn`.
- **Pages are thin.** They call `subscription_lib` hooks directly
  (`usePackagesByDuration`, `useAllOfferings`, `useOfferingPackages`,
  `useUserSubscription`, `useBackendSubscription`, `useIsUserSubscribable`,
  `isSubscriptionNativeIap`) and render `SubscriptionLayout` + `SubscriptionTile`
  + `SegmentedControl` from components-rn.
- **`onNavigateToLogin` is required; `userId` is optional.** Logged-out /
  anonymous web-billing users get login CTAs. Purchase gating is driven by
  `useIsUserSubscribable()` (the single source of truth), never by an ad-hoc
  `isLoggedIn` flag — an anonymous IAP user has a `userId` and can own a sub.
- **Hooks are always called unconditionally.** `useOfferingPackages` uses a
  `fallbackOfferId` when the "free" tab is selected (never conditional).
- **Cross-platform detection.** When `networkClient`/`baseUrl`/`token`/`userId`
  are all present (and the user is subscribable), `useBackendSubscription` fetches
  the owning platform; a mismatch renders `CrossPlatformSubscriptionInfo` instead
  of purchase UI.
- **Localization** via optional `t?: (key, fallback) => string` — every label
  passes through it with an English fallback.
- **Store management** uses `Linking.openURL(subscription.managementUrl)`; there
  is no in-app cancel (and no `Alert`-based flow).

## Gotchas

- **RN offering-ordering fix.** The native RevenueCat adapter returns NO
  offerings until an app-user id is set, and `useAllOfferings` /
  `usePackagesByDuration` can fire before `useUserSubscription` sets it. Both
  pages have a `useEffect` that refetches once the subscription load settles if
  the result came back empty. The web page does not need this — do not "simplify"
  it away.
- **Adapter is module-global state** (`currentUserId`, `configured`, `apiKey`).
  `setRevenueCatRNUser` tolerates `logOut()` throwing when already anonymous.
- **Never import `@sudobility/auth_lib` or `@sudobility/di` under the root
  barrel.** They are optional peers; Metro resolves every import a barrel
  reaches, used or not. Firebase-auth code goes behind `src/firebase.ts`.
- **`useSafeSubscription()` carries no catalog on RN today.**
  `LazySubscriptionProvider` mounts `SubscriptionProvider` from
  `@sudobility/components-rn/subscription`, whose RevenueCat calls are still
  placeholders, so `products` stays empty. What the provider does do is make
  `entityId` the RevenueCat user (`setRevenueCatRNUser` → `refreshSubscription`).
  The pages never read this context — they use `subscription_lib` hooks.

## Screen rendering — safe area & scroll insets

Honour the device safe area on **every** screen. Always use `useSafeAreaInsets()`
from `react-native-safe-area-context` (or `SafeAreaView` with explicit `edges`)
and pad by the actual inset value. **Never hard-code a padding/margin in place of
an inset** — a magic number like `paddingBottom: 80` clears today's phone and is
wrong on the next one. Decide per axis, by whether that axis scrolls:

**Vertical:**
- **NOT vertically scrollable** (fixed screen, pinned footer/CTA, camera
  overlay): content must stop at the top and bottom safe-area insets — pad top by
  `insets.top`, bottom by `insets.bottom`. Never reach the physical edge.
- **Vertically scrollable**: let the scroll view render full-bleed, and give it
  top/bottom scroll insets equal to the safe area (`contentInset` +
  `scrollIndicatorInsets`, or `contentInsetAdjustmentBehavior="automatic"`).

**Horizontal** (landscape, display cutout, rounded corners):
- **NOT horizontally scrollable**: pad left/right by `insets.left`/`insets.right`.
- **Horizontally scrollable**: render to the edges and give it L/R scroll insets.

**Bottom CTAs under a tab bar — the trap that burns everyone:** inside a tab
navigator, `insets.bottom` **already includes the tab-bar height**. So a pinned
bottom bar padded by `insets.bottom` already lands above the tab bar. Therefore:
- DO pad the bottom bar by `insets.bottom` and nothing more.
- DON'T add the tab-bar height on top, and DON'T reserve it again on the screen
  root — that double-counts and floats the CTA too high.
- DON'T pass a `tabBarHeight` that makes the bar swap the inset for a flat gap —
  that ignores the inset and drops the CTA under the tab bar.

Canonical fixed-screen shape: flex-column root → content/scroll region → bottom
action bar as the **last child** padding by `insets.bottom`, no tab-bar math.

## Related projects

- `@sudobility/subscription_lib` — platform-agnostic hooks + service singleton.
- `@sudobility/components-rn` — RN UI components (subscription subpath).
- `@sudobility/subscription_pages` — the web counterpart this mirrors.
