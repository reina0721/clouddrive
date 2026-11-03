import { defineConfig, devices } from '@playwright/test';

import { getProbeUrl, loadConfig } from '@clouddrive/config/node';

const config = loadConfig();
const primaryHost = config.web.host;
const primaryPort = config.web.port;
const primaryProbeUrl = getProbeUrl(primaryHost, primaryPort);

const secondaryPort = primaryPort + 1;
const secondaryProbeUrl = getProbeUrl(primaryHost, secondaryPort);

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: false,
  workers: 1,
  // New and changed goldens both require explicit human review.
  updateSnapshots: 'none',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: primaryProbeUrl,
    colorScheme: 'light',
    locale: 'zh-CN',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Existing product regression flows start with a normal persisted demo session.
    // Authentication tests explicitly override this with an empty browser context.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: primaryProbeUrl,
          localStorage: [
            {
              name: 'clouddrive.auth-mock',
              value: JSON.stringify({
                version: 1,
                state: {
                  accounts: [],
                  session: {
                    user: { id: 'mock-demo', name: 'Rin', email: 'demo@community.test' },
                    expiresAt: Date.now() + 7_200_000,
                  },
                },
              }),
            },
            {
              name: 'clouddrive.auth-owner',
              value: JSON.stringify({ version: 1, state: { userId: 'mock-demo' } }),
            },
          ],
        },
      ],
    },
  },
  webServer: [
    {
      command: 'pnpm --filter @clouddrive/web dev',
      env: { NEXT_DIST_DIR: '.next', NEXT_PUBLIC_AUTH_MODE: 'mock' },
      url: primaryProbeUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `pnpm --filter @clouddrive/web exec next dev --hostname ${primaryHost} --port ${secondaryPort}`,
      env: {
        NEXT_DIST_DIR: '.next/backend-contract',
        NEXT_PUBLIC_AUTH_MODE: 'backend',
        NEXT_PUBLIC_AUTH_API_BASE_URL: '/api',
      },
      url: secondaryProbeUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/*-backend.spec.ts',
      use: { browserName: 'chromium' },
    },
    {
      name: 'backend-contract',
      testMatch: '**/*-backend.spec.ts',
      use: {
        browserName: 'chromium',
        baseURL: secondaryProbeUrl,
        storageState: { cookies: [], origins: [] },
      },
    },
  ],
  outputDir: 'test-results/playwright',
});
