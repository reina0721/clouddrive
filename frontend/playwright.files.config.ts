import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const access: unknown = JSON.parse(
  readFileSync(
    resolve(__dirname, process.env.CLOUDDRIVE_FILE_TEST_ACCESS ?? '../.data/preview-access.json'),
    'utf8',
  ).replace(/^\uFEFF/, ''),
);
if (typeof access !== 'object' || !access || !('url' in access) || typeof access.url !== 'string')
  throw new Error('Run Start-FilePreview.ps1 to create preview access information.');
const previewURL = new URL(access.url);
if (previewURL.hostname !== '127.0.0.1' || previewURL.protocol !== 'http:')
  throw new Error('Files browser tests require the local preview.');
export default defineConfig({
  testDir: './file-tests',
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: previewURL.origin,
    browserName: 'chromium',
    locale: 'zh-CN',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: 'test-results/files',
});
