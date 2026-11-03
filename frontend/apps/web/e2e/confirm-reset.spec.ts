import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetPreferences(page: Page) {
  await page.goto('/settings/actions');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('重置前确认默认开：点重置弹确认，取消保留修改，确认恢复初始', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/reference-resources/edit?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const nameInput = page.getByLabel('名称');
  const initial = await nameInput.inputValue();
  await nameInput.fill('改动的名称');
  // 点重置 → 确认对话框。
  await page.getByRole('button', { name: '重置', exact: true }).first().click();
  const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
  await expect(dialog).toContainText('重置此表单？');
  // 取消（对话框内）→ 修改保留、对话框关闭。
  await dialog.getByRole('button', { name: '取消' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(nameInput).toHaveValue('改动的名称');
  // 再次重置并确认（对话框内）→ 恢复初始值。
  await page.getByRole('button', { name: '重置', exact: true }).first().click();
  await dialog.getByRole('button', { name: '重置' }).click();
  await expect(nameInput).toHaveValue(initial);
});

test('关闭 重置前确认：点重置直接恢复初始', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 操作偏好 → 重置前确认 = 关。
  await page.goto('/settings/actions');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  const confirmReset = page.getByRole('switch', { name: '重置前确认' });
  await confirmReset.focus();
  await page.keyboard.press('Space');
  await expect(confirmReset).not.toBeChecked();
  await page.waitForTimeout(300);

  await page.goto('/reference-resources/edit?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const nameInput = page.getByLabel('名称');
  const initial = await nameInput.inputValue();
  await nameInput.fill('改动的名称');
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(page.getByText('重置此表单？')).not.toBeVisible();
  await expect(nameInput).toHaveValue(initial);
});
