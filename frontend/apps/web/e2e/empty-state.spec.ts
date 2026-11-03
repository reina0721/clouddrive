import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetPreferences(page: Page) {
  await page.goto('/settings/data-display');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function gotoEmptyList(page: Page) {
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 输入无匹配词并回车（默认 enter 触发）→ 空结果。
  await page.getByRole('searchbox', { name: '搜索 Reference 数据' }).fill('zzz-no-match');
  await page.keyboard.press('Enter');
  await expect(page.getByText('筛选条件没有结果；清除筛选即可恢复完整基准数据集。')).toBeVisible();
}

test('空态辅助说明默认开：无匹配时显示说明', async ({ page }) => {
  await resetPreferences(page);
  await gotoEmptyList(page);
});

test('关闭 空数据显示辅助说明：无匹配时表格为空不显示说明', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 数据展示 → 空数据显示辅助说明 = 关。
  await page.goto('/settings/data-display');
  await page.getByRole('heading', { name: '数据展示' }).first().scrollIntoViewIfNeeded();
  const hint = page.getByRole('switch', { name: '空数据显示辅助说明' });
  await hint.focus();
  await page.keyboard.press('Space');
  await expect(hint).not.toBeChecked();
  await page.waitForTimeout(300);

  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('searchbox', { name: '搜索 Reference 数据' }).fill('zzz-no-match');
  await page.keyboard.press('Enter');
  await expect(
    page.getByText('筛选条件没有结果；清除筛选即可恢复完整基准数据集。'),
  ).not.toBeVisible();
});
