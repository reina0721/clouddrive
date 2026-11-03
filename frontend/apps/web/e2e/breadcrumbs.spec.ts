import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetPreferences(page: Page) {
  await page.goto('/settings/navigation');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('面包屑默认开：详情页显示 参考资源 → 详情 面包屑', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/reference-resources/detail?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const trail = page.getByRole('list', { name: '面包屑' });
  await expect(trail).toBeVisible();
  await expect(trail.getByText('参考资源', { exact: true })).toBeVisible();
});

test('关闭 显示面包屑：详情页不再显示面包屑', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 导航 → 显示面包屑 = 关。
  await page.goto('/settings/navigation');
  await page.getByRole('heading', { name: '导航' }).first().scrollIntoViewIfNeeded();
  const breadcrumbs = page.getByRole('switch', { name: '显示面包屑' });
  await breadcrumbs.focus();
  await page.keyboard.press('Space');
  await expect(breadcrumbs).not.toBeChecked();
  await page.waitForTimeout(300);

  await page.goto('/reference-resources/detail?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('list', { name: '面包屑' })).not.toBeVisible();
});
