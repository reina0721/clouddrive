import { defineConfig } from '@playwright/test';
import { readPreviewAccess } from './file-tests/reading-fixture';
const access = readPreviewAccess();
// 旧用例从不同目录 resolve 凭据；统一成绝对路径后不会改变其目标。
process.env.CLOUDDRIVE_FILE_TEST_ACCESS = access.path;
export default defineConfig({
  testDir: './file-tests',
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: access.origin,
    browserName: 'chromium',
    locale: 'zh-CN',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: 'test-results/files',
});
