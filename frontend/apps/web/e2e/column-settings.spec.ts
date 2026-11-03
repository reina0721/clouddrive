import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetAll(page: Page) {
  await page.goto('/settings/data-display');
  await page.evaluate(() => {
    window.localStorage.removeItem('clouddrive.shell');
    window.localStorage.removeItem('clouddrive.page-archetypes.column-layout');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('列设置：隐藏"状态"列后立即消失', async ({ page }) => {
  await resetAll(page);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 打开列设置。
  await page.getByRole('button', { name: '列设置' }).click();
  const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
  await expect(dialog).toBeVisible();
  // 取消勾选"状态"。
  await dialog.getByText('状态', { exact: true }).click();
  // 关闭对话框。
  await dialog.getByRole('button', { name: '确认' }).click();
  // 状态列头消失。
  await expect(page.getByRole('columnheader', { name: '状态' })).not.toBeVisible();
});

test('列设置持久化：隐藏"状态"列后重载仍隐藏', async ({ page }) => {
  await resetAll(page);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: '列设置' }).click();
  const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
  await dialog.getByText('状态', { exact: true }).click();
  await dialog.getByRole('button', { name: '确认' }).click();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('columnheader', { name: '状态' })).not.toBeVisible();
});
