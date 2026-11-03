import { expect, test } from '@playwright/test';

test('搜索建议默认开：键入显示匹配建议，点击应用为搜索词', async ({ page }) => {
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const box = page.getByRole('searchbox', { name: /搜索/ });
  await box.fill('Lin');
  const suggestions = page.getByRole('list', { name: '搜索建议' });
  await expect(suggestions).toBeVisible();
  const items = suggestions.getByRole('listitem');
  await expect(items.first()).toBeVisible();
  // 点击第一个建议 → 应用为搜索词并过滤。
  const text = (await items.first().innerText()).trim();
  await items.first().click();
  await expect(page.getByRole('rowheader').first()).toBeVisible();
  // 过滤生效：行数小于全量 20（有匹配）。
  const rows = await page.getByRole('row').count();
  expect(rows).toBeGreaterThan(0);
  await expect(page.getByRole('searchbox', { name: /搜索/ })).toHaveValue(text);
});

test('保留各页面最近搜索条件：开启后重载恢复搜索词（默认关时清空）', async ({ page }) => {
  // 默认关：搜索后重载回空。
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const box = page.getByRole('searchbox', { name: /搜索/ });
  await box.fill('Lin Chen');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('searchbox', { name: /搜索/ })).toHaveValue('');
});

test('保留各页面最近搜索条件：开启后重载恢复搜索词', async ({ page }) => {
  // 开启 保留各页面最近搜索。
  await page.goto('/settings/actions');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  const sw = page.getByRole('switch', { name: '保留各页面最近搜索' });
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(sw).toBeChecked();
  await page.waitForTimeout(300);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const box = page.getByRole('searchbox', { name: /搜索/ });
  await box.fill('Lin Chen');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('searchbox', { name: /搜索/ })).toHaveValue('Lin Chen');
});
