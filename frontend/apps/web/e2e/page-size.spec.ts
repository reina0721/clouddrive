import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetPreferences(page: Page) {
  await page.goto('/settings/data-display');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function setPageSize(page: Page, size: string) {
  await page.goto('/settings/data-display');
  const select = page.getByRole('button', { name: /每页数量/ });
  await select.click();
  await page.getByRole('option', { name: size, exact: true }).click();
  await page.waitForTimeout(300);
}

test('默认每页数量（数据展示 → pageSize=20）流入参考列表', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 48 条记录 / 20 = 3 页；首页 20 行 + 1 表头 = 21 行。
  await expect(page.getByRole('grid').getByRole('row')).toHaveCount(21);
});

test('每页数量=10：参考列表首页 10 行', async ({ page }) => {
  await resetPreferences(page);
  await setPageSize(page, '10');
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('grid').getByRole('row')).toHaveCount(11);
});
