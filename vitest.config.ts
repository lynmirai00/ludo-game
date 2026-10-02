import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url)).replaceAll('\\', '/');

export default defineConfig({
  resolve: {
    alias: [
      // Same as "@/*" in tsconfig.json.
      { find: /^@\//, replacement: root },
      // The real package throws outside React Server Components; tests run plain Node.
      { find: /^server-only$/, replacement: `${root}test/stubs/server-only.ts` },
    ],
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
