import { defineConfig, devices } from '@playwright/test';

import { getProbeUrl, loadConfig } from '@clouddrive/config/node';

const config = loadConfig();
const primaryHost = config.web.host;
const primaryPort = config.web.port;
const primaryProbeUrl = getProbeUrl(primaryHost, primaryPort);

const secondaryPort = primaryPort + 1;
const developmentPort = primaryPort + 2;
if (developmentPort > 65535) throw new Error('Browser tests require WEB_PORT between 1 and 65533.');
const secondaryProbeUrl = getProbeUrl(primaryHost, secondaryPort);
const developmentProbeUrl = getProbeUrl(primaryHost, developmentPort);
const primaryDist = `.next/playwright-${primaryPort}/mock-production`;
const secondaryDist = `.next/playwright-${secondaryPort}/backend-production`;

function demoStorageState(origin: string) {
  return {
    cookies: [],
    origins: [
      {
        origin,
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
  };
}

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
    storageState: demoStorageState(primaryProbeUrl),
  },
  webServer: [
    {
      command: `pnpm --filter @clouddrive/web build && node apps/web/${primaryDist}/standalone/apps/web/server.js`,
      env: {
        CLOUDDRIVE_BROWSER_TEST: '1',
        WEB_PORT: String(primaryPort),
        NEXT_DIST_DIR: primaryDist,
        WEB_DEPLOYMENT_MODE: 'server',
        HOSTNAME: primaryHost,
        PORT: String(primaryPort),
        NEXT_PUBLIC_AUTH_MODE: 'mock',
      },
      url: primaryProbeUrl,
      // 就绪探针不能证明占用此端口的服务采用了要求的认证模式。
      reuseExistingServer: false,
      // 包含完整生产构建；交互与断言仍使用原来的超时。
      timeout: 300_000,
    },
    {
      command: `pnpm --filter @clouddrive/web build && node apps/web/${secondaryDist}/standalone/apps/web/server.js`,
      env: {
        CLOUDDRIVE_BROWSER_TEST: '1',
        WEB_PORT: String(secondaryPort),
        NEXT_DIST_DIR: secondaryDist,
        WEB_DEPLOYMENT_MODE: 'server',
        HOSTNAME: primaryHost,
        PORT: String(secondaryPort),
        NEXT_PUBLIC_AUTH_MODE: 'backend',
        NEXT_PUBLIC_AUTH_API_BASE_URL: '/api',
      },
      url: secondaryProbeUrl,
      reuseExistingServer: false,
      timeout: 300_000,
    },
    {
      command: 'pnpm --filter @clouddrive/web dev',
      env: {
        CLOUDDRIVE_BROWSER_TEST: '1',
        WEB_PORT: String(developmentPort),
        NEXT_DIST_DIR: `.next/playwright-${developmentPort}/inspector-development`,
        NEXT_PUBLIC_AUTH_MODE: 'mock',
      },
      url: `${developmentProbeUrl}/motion`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      testIgnore: ['**/*-backend.spec.ts', '**/*-dev.spec.ts'],
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
    {
      name: 'development-contract',
      testMatch: '**/*-dev.spec.ts',
      use: {
        browserName: 'chromium',
        baseURL: developmentProbeUrl,
        storageState: demoStorageState(developmentProbeUrl),
      },
    },
  ],
  outputDir: 'test-results/playwright',
});
