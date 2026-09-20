import { defineConfig } from 'vitest/config';
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Run npm run test:integration with both Firebase emulators.');
}
export default defineConfig({
  resolve: { alias: { '@': `${import.meta.dirname}/src` } },
  test: {
    environment: 'node', include: ['tests/firebase.rules.test.ts', 'tests/integration/**/*.test.ts'], fileParallelism: false, testTimeout: 30000, hookTimeout: 30000,
    coverage: { provider: 'v8', reporter: ['text', 'json-summary'], reportsDirectory: 'coverage/integration', include: ['src/ai/generation-store.ts', 'src/ai/route-utils.ts', 'src/lib/server-api.ts', 'src/app/api/ai/**/*.ts'] },
  },
});
