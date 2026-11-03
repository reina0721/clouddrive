import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import type { Page } from '@playwright/test';

/** Capture once; retry only transient Windows file-open failures when saving evidence. */
export async function saveEvidenceScreenshot(
  page: Page,
  options: NonNullable<Parameters<Page['screenshot']>[0]> & { path: string },
) {
  const { path: requestedPath, ...captureOptions } = options;
  const path =
    process.env.UPDATE_EVIDENCE === 'true' || isAbsolute(requestedPath)
      ? requestedPath
      : join('test-results/evidence', requestedPath);
  const screenshot = await page.screenshot(captureOptions);
  await mkdir(dirname(path), { recursive: true });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await writeFile(path, screenshot);
      return screenshot;
    } catch (error) {
      const transientOpenFailure =
        error instanceof Error &&
        'code' in error &&
        typeof error.code === 'string' &&
        'syscall' in error &&
        error.syscall === 'open' &&
        ['UNKNOWN', 'EBUSY', 'EPERM'].includes(error.code);
      if (!transientOpenFailure || attempt === 2) throw error;
      await setTimeout(100 * (attempt + 1));
    }
  }
  throw new Error('Screenshot evidence was not written.');
}
