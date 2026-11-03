import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** 设 dataDisplay.tableDensity 为指定值。 */
async function setTableDensity(page: Page, density: 'compact' | 'standard') {
  await page.goto('/settings/data-display');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const group = page.getByRole('radiogroup', { name: '表格密度' });
  const optionLabel = density === 'compact' ? '紧凑' : '标准';
  await group.getByText(optionLabel, { exact: true }).click();
  await expect(group.getByRole('radio', { name: new RegExp(`^${optionLabel}`) })).toBeChecked();
  // 等待持久化落盘（localStorage 写入异步 tick）。
  await page.waitForTimeout(300);
}

test('全局默认表格密度流入参考列表（数据展示 → 资源列表）', async ({ page }) => {
  // 设 紧凑。
  await setTableDensity(page, 'compact');
  // 参考列表（page-archetypes/resource-list）首次加载应应用全局默认。
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 密度 Select 触发按钮当前值 = 紧凑（来自全局默认偏好；accessible name 含字段标签）。
  await expect(page.getByRole('button', { name: '紧凑 表格密度' })).toBeVisible();
});

test('页面显式操作优先于全局默认（参考列表密度切换为舒适）', async ({ page }) => {
  await setTableDensity(page, 'compact');
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 页面显式切到舒适 → 覆盖全局默认。
  await page.getByRole('button', { name: '紧凑 表格密度' }).click();
  await page.getByRole('option', { name: '舒适' }).click();
  await expect(page.getByRole('button', { name: '舒适 表格密度' })).toBeVisible();
});
