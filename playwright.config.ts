import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  timeout: 90000,
  expect: { timeout: 30000 },
  testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://127.0.0.1:9002', actionTimeout: 20000, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['Pixel 7'] } }, { name: 'webkit', use: { ...devices['Desktop Safari'] } }, { name: 'firefox', use: { ...devices['Desktop Firefox'] } }],
  webServer: [
    { command: 'node tests/e2e/ai-server.mjs', url: 'http://127.0.0.1:9098', reuseExistingServer: false },
    { command: process.env.E2E_PRODUCTION === 'true' ? 'node node_modules/next/dist/bin/next start -p 9002' : 'node node_modules/next/dist/bin/next dev --turbopack -p 9002', url: 'http://127.0.0.1:9002/login', timeout: 180000, reuseExistingServer: false,
      env: { SHARK_EMULATOR_TEST_MODE: 'true', AI_GENERATION_PROTOCOL_ENABLED: 'true', NEXT_PUBLIC_USE_EMULATORS: 'true', GCLOUD_PROJECT: 'demo-shark-empti', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-shark-empti', NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key', NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-shark-empti.firebaseapp.com', NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-shark-empti.appspot.com', NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456', NEXT_PUBLIC_FIREBASE_APP_ID: 'demo-app', OPENROUTER_API_KEY: 'test-only', OPENROUTER_TEST_URL: 'http://127.0.0.1:9098' } },
  ],
});
