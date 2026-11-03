import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetPreferences(page: Page) {
  await page.goto('/settings/data-display');
  await page.evaluate(() => {
    window.localStorage.removeItem('clouddrive.shell');
    window.localStorage.removeItem('clouddrive.workspace');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function fullRowCount(page: Page): Promise<number> {
  // Preference hydration precedes session restoration; wait for the protected data surface.
  await expect(page.getByRole('grid')).toBeVisible();
  return page.getByRole('grid').getByRole('row').count();
}

test('记住筛选条件默认关：状态筛选后重载回默认全部', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('grid').getByRole('row')).toHaveCount(21);
  const full = await fullRowCount(page);
  // 状态 = 需关注。
  await page.getByRole('button', { name: '全部 状态', exact: true }).click();
  await page.getByRole('option', { name: '需关注' }).click();
  await expect(page.getByRole('button', { name: '需关注 状态', exact: true })).toBeVisible();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 默认关：回全部（行数恢复完整）。
  await expect(page.getByRole('button', { name: '全部 状态', exact: true })).toBeVisible();
  expect(await fullRowCount(page)).toBe(full);
});

test('开启 记住筛选条件：状态筛选后重载仍保持', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 数据展示 → 记住筛选条件 = 开。
  await page.goto('/settings/data-display');
  await page.getByRole('heading', { name: '数据展示' }).first().scrollIntoViewIfNeeded();
  const remember = page.getByRole('switch', { name: '记住筛选条件' });
  await remember.focus();
  await page.keyboard.press('Space');
  await expect(remember).toBeChecked();
  await page.waitForTimeout(300);

  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: '全部 状态', exact: true }).click();
  await page.getByRole('option', { name: '需关注' }).click();
  await expect(page.getByRole('button', { name: '需关注 状态', exact: true })).toBeVisible();
  const filtered = await fullRowCount(page);
  expect(filtered).toBeLessThan(20);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 筛选保持。
  await expect(page.getByRole('button', { name: '需关注 状态', exact: true })).toBeVisible();
  expect(await fullRowCount(page)).toBe(filtered);
});
