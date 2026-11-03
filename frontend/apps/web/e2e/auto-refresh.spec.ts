import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetPreferences(page: Page) {
  await page.goto('/settings/actions');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('自动刷新默认关闭：参考列表不显示自动刷新指示', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByText(/自动刷新/)).not.toBeVisible();
});

test('自动刷新=定期刷新：参考列表显示自动刷新指示', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 操作偏好 → 自动刷新数据 = 定期刷新。
  await page.goto('/settings/actions');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  await page
    .getByRole('radiogroup', { name: '自动刷新数据' })
    .getByText('定期刷新', { exact: true })
    .click();
  await page.waitForTimeout(300);

  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByText(/自动刷新已开启|上次自动刷新/)).toBeVisible();
});

test('自动刷新=仅页面重新进入时：进入页面即刷新并显示指示', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 操作偏好 → 自动刷新数据 = 仅页面重新进入时。
  await page.goto('/settings/actions');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  await page
    .getByRole('radiogroup', { name: '自动刷新数据' })
    .getByText('仅页面重新进入时', { exact: true })
    .click();
  await page.waitForTimeout(300);

  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 指示显示且带上次时间（mount 已刷新）。
  await expect(page.getByText(/上次自动刷新 \d/)).toBeVisible();
});
