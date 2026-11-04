# subscription_pages_rn - AI Development Guide

> **Git policy — never auto-commit or auto-push.** Leave your work in the working tree.
> Run `git commit`, `git push`, `gh pr create`, or `scripts/push_all.sh` **only when the user
> explicitly asks in that turn**. Approval for an earlier change does not carry forward, and
> finishing a task is not permission to commit it.

## Overview

React Native page components for subscription management. Provides ready-to-use screens for choosing subscription plans by duration (billing period) or by offer (product catalog). Uses `@sudobility/subscription_lib` hooks for data fetching and `@sudobility/subscription-components-rn` for UI tiles.

- **Package**: `@sudobility/subscription_pages_rn`
- **Version**: 0.0.1
- **License**: BUSL-1.1
- **Package Manager**: Bun (never npm)
- **TypeScript**: ^5.5.0, target ES2020, bundler module resolution, strict mode
- **Build output**: `dist/` (declarations + JS)

## Project Structure

```
subscription_pages_rn/
├── package.json
├── bun.lock
├── tsconfig.json              # Base TS config (strict, declarations, outDir: dist/)
├── tsconfig.build.json        # Build config (extends base, excludes tests)
└── src/
    ├── index.ts               # Barrel exports (all pages + prop types)
    └── pages/
        ├── index.ts           # Page barrel exports
        ├── SubscriptionByDurationPage.tsx  # Plans grouped by billing period
        └── SubscriptionByOfferPage.tsx     # Plans grouped by offering
```

## Key Exports

| Export | Type | Description |
|--------|------|-------------|
| `SubscriptionByDurationPage` | component | Subscription plans grouped by billing period (monthly, yearly, etc.) |
| `SubscriptionByOfferPage` | component | Subscription plans grouped by offering with Free tab |
| `SubscriptionByDurationPageProps` | interface | Props: `userId`, `userEmail?`, `featuresByPackage?`, `freeFeatures?`, `title?`, `onPurchaseSuccess?`, `onRestoreSuccess?` |
| `SubscriptionByOfferPageProps` | interface | Props: `userId`, `userEmail?`, `featuresByPackage?`, `freeFeatures?`, `title?`, `onPurchaseSuccess?`, `onRestoreSuccess?` |

## Commands

```bash
bun run build        # Build TypeScript to dist/ (uses tsconfig.build.json)
bun run typecheck    # TypeScript check (no emit)
```

## Peer Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | >=18 | React core |
| `react-native` | >=0.74 | React Native framework |
| `@sudobility/subscription_lib` | ^0.0.25 | Subscription hooks and service singleton |
| `@sudobility/subscription-components-rn` | ^1.0.0 | RN subscription UI components (SubscriptionTile, SegmentedControl, SubscriptionLayout) |
| `@sudobility/types` | ^1.9.58 | Shared type definitions (SubscriptionPeriod) |

## Coding Patterns

- **RN-only: userId is required** -- no anonymous/logged-out state. Users are always authenticated on mobile.
- **Uses subscription_lib hooks directly** -- pages call `usePackagesByDuration`, `useAllOfferings`, `useOfferingPackages`, `useUserSubscription`.
- **Uses subscription-components-rn for UI** -- `SubscriptionLayout` (with `currentStatus`, `aboveProducts`, `footerContent`), `SegmentedControl`, `SubscriptionTile` (individual props: `id`, `title`, `price`, `features`, etc.), `SubscriptionFooter`.
- **Passes individual props to SubscriptionTile** -- subscription_lib `SubscriptionPackage` fields are mapped directly to tile props (`id`, `title`, `price`, `periodLabel`, `features`, `isCurrentPlan`). Uses `getPeriodLabel()` helper to convert period strings to display labels.
- **SubscriptionLayout handles status display** -- current subscription status is passed via `currentStatus` prop (with `activeContent.title` and `activeContent.fields`) instead of custom StyleSheet banner.
- **RN StyleSheet.create for page-level styling** -- loading/error states and purchasing overlays use plain React Native styles.
- **Alert.alert for confirmations** -- cancel subscription and error handling use native alerts.
- **Linking.openURL for management** -- cancel/manage subscription redirects to the store management URL.
- **Hooks always called unconditionally** -- `useOfferingPackages` in ByOffer page uses a fallback offerId when 'free' is selected.
- **Purchasing overlay** -- semi-transparent overlay with ActivityIndicator during purchase/restore operations.

## Related Projects

- **subscription_lib** (`@sudobility/subscription_lib`) -- provides hooks (`usePackagesByDuration`, `useAllOfferings`, `useOfferingPackages`, `useUserSubscription`) and singleton (`getSubscriptionInstance`, `refreshSubscription`, `restoreSubscription`).
- **subscription-components-rn** (`@sudobility/subscription-components-rn`) -- provides UI components (`SubscriptionTile`, `SubscriptionLayout`, `SegmentedControl`, `SubscriptionFooter`).
- **subscription_pages** (`@sudobility/subscription_pages`) -- web counterpart of this package.

## Git Workflow

- Do not use feature branches for code changes. Always stay on the current branch.

## Screen rendering — safe area & scroll insets

Honour the device safe area on **every** screen. Always use `useSafeAreaInsets()`
from `react-native-safe-area-context` (or a `SafeAreaView` with explicit `edges`)
and pad by the actual inset value. **Never hard-code a padding/margin in place of
an inset** — a magic number like `paddingBottom: 80` happens to clear today's
phone and is wrong on the next one.

Decide per axis, by whether that axis scrolls:

**Vertical:**
- **NOT vertically scrollable** (a fixed screen, a pinned footer/CTA, a camera
  overlay): the content area must stop at the **top and bottom** safe-area insets
  — pad top by `insets.top`, bottom by `insets.bottom`. It must not reach the
  physical top/bottom edge (status bar / notch / home indicator).
- **Vertically scrollable**: let the scroll view render **full-bleed** to the top
  and bottom edges, and give it top/bottom **scroll insets** equal to the safe
  area (`contentInset` + `scrollIndicatorInsets`, or
  `contentInsetAdjustmentBehavior="automatic"`). Content then starts/ends clear of
  the unsafe regions while still scrolling edge-to-edge behind them.

**Horizontal** (landscape, display cutout, rounded corners):
- **NOT horizontally scrollable**: pad left/right by `insets.left` / `insets.right`.
- **Horizontally scrollable**: render to the left/right edges and give it
  left/right scroll insets.

**Bottom CTAs under a tab bar — the trap that burns everyone:** inside a tab
navigator, the bottom safe-area inset (`insets.bottom`, and what a shared
`BottomActionBar` reads) **already includes the tab-bar height**. So a pinned
bottom bar padded by `insets.bottom` already lands above the tab bar. Therefore:
- DO pad the bottom bar by `insets.bottom` and nothing more.
- DON'T add the tab-bar height on top of the inset, and DON'T reserve it again on
  the screen root — that double-counts and floats the CTA too high.
- DON'T pass a `tabBarHeight` (or similar) that makes the bar swap the inset for a
  flat fixed gap — that ignores the inset and drops the CTA under the tab bar.

Canonical fixed-screen shape: a flex-column root → the content/scroll region →
a bottom action bar as the **last child** that pads by `insets.bottom` with no
manual tab-bar math. Copy a screen already doing this correctly (e.g. a Settings
screen with a Sign-Out button) rather than re-deriving the padding.
