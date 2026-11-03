import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** 清空偏好。 */
async function resetPreferences(page: Page) {
  await page.goto('/settings/navigation');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('导航默认不记忆展开菜单（menuMemory 关）：SPA 换路由后展开状态重置', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 展开 Page Archetypes（非当前 active 路径：当前在 /）。
  const branch = page.getByRole('button', { name: '展开或收起Page Archetypes' });
  await branch.click();
  await expect(branch).toHaveAttribute('aria-expanded', 'true');
  // SPA 导航到另一分支页面（/system-tools/icons），使旧 exploration 失效。
  await page.getByRole('link', { name: 'Icon 大全' }).click();
  await expect(page).toHaveURL(/\/system-tools\/icons/);
  // SPA 返回根入口 → Page Archetypes 不应保持展开（menuMemory 默认关）。
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '工作台' })
    .first()
    .click();
  await expect(page).toHaveURL(/\/$/);
  const branchAfter = page.getByRole('button', { name: '展开或收起Page Archetypes' });
  await expect(branchAfter).toHaveAttribute('aria-expanded', 'false');
});

test('导航记忆展开菜单（menuMemory 开）：SPA 导航后手动展开仍保留', async ({ page }) => {
  await resetPreferences(page);
  // 打开 设置 → 导航 → 记住展开的侧栏菜单。
  await page.goto('/settings/navigation');
  await page.getByRole('heading', { name: '导航' }).first().scrollIntoViewIfNeeded();
  const memorySwitch = page.getByRole('switch', { name: '记住展开的侧栏菜单' });
  await memorySwitch.focus();
  await page.keyboard.press('Space');
  await expect(memorySwitch).toBeChecked();

  // 从设置页经侧栏 SPA 导航到根入口（总览）。
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '工作台' })
    .first()
    .click();
  await expect(page).toHaveURL(/\/$/);
  // 手动展开 Page Archetypes。
  const branch = page.getByRole('button', { name: '展开或收起Page Archetypes' });
  await branch.click();
  await expect(branch).toHaveAttribute('aria-expanded', 'true');
  // SPA 导航到另一分支页面（menuMemory 开 → exploration 跨路由携带）。
  await page.getByRole('link', { name: 'Icon 大全' }).click();
  await expect(page).toHaveURL(/\/system-tools\/icons/);
  // SPA 返回根入口 → Page Archetypes 应保持展开。
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '工作台' })
    .first()
    .click();
  await expect(page).toHaveURL(/\/$/);
  const branchAfter = page.getByRole('button', { name: '展开或收起Page Archetypes' });
  await expect(branchAfter).toHaveAttribute('aria-expanded', 'true');
});
