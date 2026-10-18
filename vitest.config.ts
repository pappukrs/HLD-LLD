import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['lld/**/*.test.ts', 'hld/**/*.test.ts'],
  },
});
