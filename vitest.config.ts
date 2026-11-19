import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
  resolve: {
    alias: {
      // The real package is Flow-typed native code; the specs render against a
      // DOM stand-in.
      'react-native': path.resolve(
        __dirname,
        'src/__tests__/mocks/react-native.ts'
      ),
    },
  },
});
