import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetAll(page: Page) {
  await page.goto('/settings');
  await page.evaluate(() => {
    window.localStorage.removeItem('clouddrive.shell');
    window.localStorage.removeItem('clouddrive.workbench');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('收藏能力保留在详情页，首页仅保留最近访问', async ({ page }) => {
  await resetAll(page);
  await page.goto('/reference-resources/detail?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: '收藏此页' }).click();
  // 已收藏态。
  await expect(page.getByRole('button', { name: '取消收藏' })).toBeVisible();
  // 首页显示收藏区段。
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('heading', { name: '收藏', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '参考资源详情' })).toBeVisible();
});

test('最近访问：访问参考列表后首页"最近访问"区段展示（默认开）', async ({ page }) => {
  await resetAll(page);
  await page.goto('/reference-resources');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.waitForTimeout(400);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('heading', { name: '最近访问' })).toBeVisible();
});
