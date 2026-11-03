import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({ acceptDownloads: true });

async function resetPreferences(page: Page) {
  await page.goto('/settings/actions');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function selectTwoRows(page: Page) {
  const rows = page.getByRole('grid').getByRole('row');
  await rows.nth(1).click();
  await rows.nth(2).click();
  await expect(page.getByText('已选 2 条')).toBeVisible();
}

test('批量操作前确认默认开：导出所选弹二次确认，取消不导出', async ({ page }) => {
  await resetPreferences(page);
  await page.addInitScript(() => {
    const createObjectURL = URL.createObjectURL.bind(URL);
    let attempts = 0;
    URL.createObjectURL = (value) => {
      if (++attempts === 1) throw new Error('Export unavailable on first attempt');
      return createObjectURL(value);
    };
  });
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await selectTwoRows(page);
  await page.getByRole('button', { name: '导出已选' }).click();
  const dialog = page.getByRole('alertdialog', { name: '导出所选 2 条？', exact: true });
  await expect(dialog).toContainText('导出所选 2 条？');
  // 取消 → 不导出、对话框关闭。
  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(dialog).not.toBeVisible();
  // 再次确认：按需加载的导出模块必须下载真实的所选记录。
  await page.getByRole('button', { name: '导出已选' }).click();
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('导出失败，请重试。');
  await expect(dialog).toBeVisible();
  const downloadReady = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  const download = await downloadReady;
  expect(download.suggestedFilename()).toBe('frontend-reference-snapshot.json');
  const filePath = await download.path();
  if (!filePath) throw new Error('Missing exported file');
  const snapshot: unknown = JSON.parse(await readFile(filePath, 'utf8'));
  if (!snapshot || typeof snapshot !== 'object' || !('records' in snapshot)) {
    throw new Error('Missing exported records');
  }
  expect(snapshot).toHaveProperty('recordCount', 2);
  expect(Array.isArray(snapshot.records)).toBe(true);
  expect(snapshot.records).toHaveLength(2);
  await expect(dialog).not.toBeVisible();
});

test('关闭 批量操作前确认：导出所选直接执行（无确认）', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 操作偏好 → 批量操作前确认 = 关。
  await page.goto('/settings/actions');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  const confirmBulk = page.getByRole('switch', { name: '批量操作前确认' });
  await confirmBulk.focus();
  await page.keyboard.press('Space');
  await expect(confirmBulk).not.toBeChecked();
  await page.waitForTimeout(300);

  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await selectTwoRows(page);
  await page.getByRole('button', { name: '导出已选' }).click();
  await expect(page.getByText('导出所选 2 条？')).not.toBeVisible();
});
