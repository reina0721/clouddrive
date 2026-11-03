import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetPreferences(page: Page) {
  await page.goto('/settings/actions');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('搜索时机默认 Enter：键入不立即过滤，回车后过滤（48 记录中 Lin Chen 约 12 条）', async ({
  page,
}) => {
  await resetPreferences(page);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const search = page.getByRole('searchbox', { name: '搜索 Reference 数据' });
  await search.fill('Lin Chen');
  // 未按 Enter：仍 20 行/页（21 行含表头）。
  await expect(page.getByRole('grid').getByRole('row')).toHaveCount(21);
  // 回车应用过滤 → 行数下降。
  await page.keyboard.press('Enter');
  await expect(page.getByRole('grid').getByRole('row').first()).toBeVisible();
  const rowsAfter = await page.getByRole('grid').getByRole('row').count();
  expect(rowsAfter).toBeLessThan(21);
});

test('搜索时机=输入后自动搜索：键入立即过滤', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 操作偏好 → 搜索时机 = 输入后自动搜索。
  await page.goto('/settings/actions');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  await page
    .getByRole('radiogroup', { name: '搜索时机' })
    .getByText('输入后自动搜索', { exact: true })
    .click();
  await page.waitForTimeout(300);

  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('searchbox', { name: '搜索 Reference 数据' }).fill('Lin Chen');
  // 无需回车即过滤。
  await expect(page.getByRole('grid').getByRole('row').first()).toBeVisible();
  const rows = await page.getByRole('grid').getByRole('row').count();
  expect(rows).toBeLessThan(21);
});
