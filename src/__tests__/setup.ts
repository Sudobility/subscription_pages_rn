/**
 * Vitest setup.
 *
 * `react-native` is aliased to a DOM mock (see vitest.config.ts). The specs
 * mock `@sudobility/subscription_lib` and `@sudobility/components-rn` per
 * file, the way the web package's specs mock their counterparts, so each spec
 * states exactly what the page is given.
 */
import { afterEach, vi } from 'vitest';
import { Platform } from 'react-native';

// React's act() warns unless the environment says it is a test environment.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
  // A spec may switch platform; the next one starts on iOS again.
  Platform.OS = 'ios';
  vi.restoreAllMocks();
});
