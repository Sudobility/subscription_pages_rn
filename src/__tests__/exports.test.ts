/**
 * The public surface, held against @sudobility/subscription_pages (web).
 *
 * Every name the web package exports from its root must be importable here
 * under the same name. The one that is not at the root —
 * LazySubscriptionProvider — is at `/firebase`, for the reason recorded in
 * src/firebase.ts.
 */
import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// Mock transitive dependencies to avoid module resolution issues
vi.mock('@sudobility/subscription_lib', () => ({
  usePackagesByDuration: vi.fn(),
  useAllOfferings: vi.fn(),
  useOfferingPackages: vi.fn(),
  useUserSubscription: vi.fn(),
  useBackendSubscription: vi.fn(),
  useIsUserSubscribable: vi.fn(),
  isSubscriptionNativeIap: vi.fn(),
  getSubscriptionInstance: vi.fn(),
  refreshSubscription: vi.fn(),
  periodToMonths: vi.fn(),
}));

vi.mock('@sudobility/components-rn/subscription', () => ({
  SubscriptionLayout: vi.fn(),
  SubscriptionTile: vi.fn(),
  SegmentedControl: vi.fn(),
  SubscriptionProvider: vi.fn(),
  useSubscriptionContext: vi.fn(),
}));

vi.mock('@sudobility/components-rn', () => ({
  cn: vi.fn(),
  pressProps: vi.fn(),
}));

vi.mock('@sudobility/auth_lib/auth-js', () => ({
  useIsLoggedIn: vi.fn(),
  useAuthUser: vi.fn(),
}));

vi.mock('@sudobility/di/info', () => ({ getInfoService: vi.fn() }));

import * as root from '../index';
import * as firebase from '../firebase';
import * as pages from '../pages';

/** Runtime exports of @sudobility/subscription_pages' src/index.ts. */
const WEB_ROOT_EXPORTS = [
  'SubscriptionByDurationPage',
  'SubscriptionByOfferPage',
  'configureRevenueCatAdapter',
  'createRevenueCatAdapter',
  'setRevenueCatUser',
  'clearRevenueCatUser',
  'hasRevenueCatUser',
  'SafeSubscriptionContext',
  'STUB_SUBSCRIPTION_VALUE',
  'useSafeSubscription',
  'LazySubscriptionProvider',
];

/** Web exports that live on another entry point here, and which one. */
const MOVED: Record<string, Record<string, unknown>> = {
  LazySubscriptionProvider: firebase,
};

const SRC = resolve(__dirname, '..');

/** Peers an app may not have installed (see package.json). */
const OPTIONAL_PEERS = /^@sudobility\/(auth_lib|di)(\/|$)/;

/** A relative specifier's source file. */
function sourceFile(from: string, specifier: string): string {
  const base = resolve(dirname(from), specifier);
  const found = [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ].find(candidate => existsSync(candidate));
  if (!found) throw new Error(`Cannot resolve ${specifier} from ${from}`);
  return found;
}

/** Every package specifier a source file imports, directly or through others. */
function packagesImportedFrom(entry: string): string[] {
  const seen = new Set<string>();
  const packages = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(file, 'utf8');
    for (const [, specifier] of text.matchAll(/\bfrom\s+'([^']+)'/g)) {
      if (specifier.startsWith('.')) visit(sourceFile(file, specifier));
      else packages.add(specifier);
    }
  };
  visit(entry);
  return [...packages].sort();
}

describe('pages/index exports', () => {
  it('exports SubscriptionByDurationPage', () => {
    expect(pages.SubscriptionByDurationPage).toBeDefined();
    expect(typeof pages.SubscriptionByDurationPage).toBe('function');
  });

  it('exports SubscriptionByOfferPage', () => {
    expect(pages.SubscriptionByOfferPage).toBeDefined();
    expect(typeof pages.SubscriptionByOfferPage).toBe('function');
  });
});

describe('package exports', () => {
  it.each(WEB_ROOT_EXPORTS)('has the web export %s', name => {
    const entry = MOVED[name] ?? (root as Record<string, unknown>);
    expect(entry[name]).toBeDefined();
  });

  it('keeps Firebase-auth code out of the root barrel', () => {
    // Metro bundles everything the root imports; an app without
    // @sudobility/auth_lib must still be able to import the root.
    expect(root).not.toHaveProperty('LazySubscriptionProvider');
    expect(typeof firebase.LazySubscriptionProvider).toBe('function');
  });

  it('imports no optional peer anywhere under the root barrel', () => {
    const packages = packagesImportedFrom(join(SRC, 'index.ts'));

    expect(packages).toContain('@sudobility/subscription_lib');
    expect(packages.filter(name => OPTIONAL_PEERS.test(name))).toEqual([]);
    // The same walk does find them under the entry that is allowed to.
    expect(
      packagesImportedFrom(join(SRC, 'firebase.ts')).filter(name =>
        OPTIONAL_PEERS.test(name)
      )
    ).toEqual(['@sudobility/auth_lib/auth-js', '@sudobility/di/info']);
  });

  it('keeps the React Native adapter names apps already import', () => {
    expect(typeof root.configureRevenueCatRNAdapter).toBe('function');
    expect(typeof root.createRevenueCatRNAdapter).toBe('function');
    expect(typeof root.setRevenueCatRNUser).toBe('function');
    expect(typeof root.clearRevenueCatRNUser).toBe('function');
    expect(typeof root.hasRevenueCatRNUser).toBe('function');
  });

  it('exports the web adapter names as the same React Native adapter', () => {
    expect(root.configureRevenueCatAdapter).toBe(
      root.configureRevenueCatRNAdapter
    );
    expect(root.createRevenueCatAdapter).toBe(root.createRevenueCatRNAdapter);
    expect(root.setRevenueCatUser).toBe(root.setRevenueCatRNUser);
    expect(root.clearRevenueCatUser).toBe(root.clearRevenueCatRNUser);
    expect(root.hasRevenueCatUser).toBe(root.hasRevenueCatRNUser);
  });
});
