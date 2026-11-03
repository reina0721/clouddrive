import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetPreferences(page: Page) {
  await page.goto('/settings/navigation');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function spaToSettings(page: Page) {
  const nav = page.getByRole('navigation', { name: '主导航' });
  await nav.getByRole('link', { name: '个人偏好', exact: true }).click();
  await page.waitForURL(/\/settings$/);
}

test('跳转后自动滚顶默认开：长页滚下后导航到设置 → 回到顶部', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('grid').getByRole('row')).toHaveCount(21);
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(100);
  await spaToSettings(page);
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 页面实现按需加载：等真实内容出现再断言滚动位置（固定等待在 dev 冷编译下不稳定）。
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.scrollY);
  expect(after).toBeLessThan(50);
});

test('关闭 跳转后自动滚顶：长页滚下后导航保持滚动位置', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 导航 → 跳转后自动滚顶 = 关。
  await page.goto('/settings/navigation');
  await page.getByRole('heading', { name: '导航' }).first().scrollIntoViewIfNeeded();
  const scrollPref = page.getByRole('switch', { name: '跳转后自动滚动到顶部' });
  await scrollPref.focus();
  await page.keyboard.press('Space');
  await expect(scrollPref).not.toBeChecked();
  await page.waitForTimeout(300);

  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('grid').getByRole('row')).toHaveCount(21);
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(300);
  await spaToSettings(page);
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.scrollY);
  expect(after).toBeGreaterThan(100);
});
