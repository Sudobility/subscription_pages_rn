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

- **Package**: `@sudobility/subscription_pages_rn` (v0.0.94), BUSL-1.1
- **Package manager**: Bun (never npm). `type: module` (ESM).
- **TypeScript**: ~6.0.x, target ES2020, `moduleResolution: bundler`, strict.
- **Build output**: `dist/` (declarations + JS). Library only — no app, no tests.
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
```

`fix-esm-imports.mjs` rewrites emitted relative imports to fully-qualified paths
(`./core` → `./core/index.js`) so Node's native ESM loader can resolve tsc's
`bundler`-style output. Must run after every build; it is idempotent.

## Structure

```
src/
├── index.ts                 # Barrel: re-exports pages, adapter, provider
├── nativewind.d.ts          # Augments RN props with `className` for NativeWind
├── pages/
│   ├── SubscriptionByDurationPage.tsx
│   └── SubscriptionByOfferPage.tsx
├── adapters/revenuecat-rn.ts        # SubscriptionAdapter impl (react-native-purchases)
├── providers/SafeSubscriptionContext.tsx
└── components/CrossPlatformSubscriptionInfo.tsx
```

## Key Exports (`src/index.ts`)

- `SubscriptionByDurationPage` / `SubscriptionByOfferPage` (+ their `...Props`).
- Adapter: `configureRevenueCatRNAdapter`, `createRevenueCatRNAdapter`,
  `setRevenueCatRNUser`, `clearRevenueCatRNUser`, `hasRevenueCatRNUser`.
- Context: `SafeSubscriptionContext`, `useSafeSubscription`,
  `STUB_SUBSCRIPTION_VALUE`, `SubscriptionContextValue`.

## Peer dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` / `react-native` | >=18 / >=0.74 | framework |
| `react-native-purchases` | >=7.0.0 | **optional** — RevenueCat SDK, only for the adapter |
| `@sudobility/subscription_lib` | ^0.0.65 | hooks + singleton service (`getSubscriptionInstance`, `refreshSubscription`) |
| `@sudobility/components-rn` | ^1.0.150 | UI tiles via `@sudobility/components-rn/subscription` |
| `@sudobility/types` | ^1.9.78 | shared types (`SubscriptionPlatform`, `SubscriptionPeriod`, `NetworkClient`) |
| `@sudobility/design` | ^1.1.69 | design tokens |

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
