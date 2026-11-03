import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** 清空偏好。 */
async function resetPreferences(page: Page) {
  await page.goto('/settings/locale');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function setDateFormat(page: Page, format: string) {
  await page.goto('/settings/locale');
  const group = page.getByLabel('日期格式');
  await group.click();
  await page.getByRole('option', { name: format, exact: true }).click();
  await page.waitForTimeout(300);
}

test('地区日期格式流入参考列表 updated 列（默认 YYYY-MM-DD）', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 首条基准记录 updatedAt = 2026-08-29（UTC）。
  await expect(page.getByText('2026-08-29').first()).toBeVisible();
});

test('切换日期格式 MM/DD/YYYY 后 updated 列实时按新格式显示', async ({ page }) => {
  await resetPreferences(page);
  await setDateFormat(page, 'MM/DD/YYYY');
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByText('08/29/2026').first()).toBeVisible();
});
