import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function publishAndOpenCenter(page: Page) {
  await page.goto('/reference-resources/edit?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: /保存/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /通知/ }).first().click();
  const drawer = page.locator('[role="dialog"], [role="alertdialog"]');
  await expect(drawer).toBeVisible();
  return drawer;
}

test('未读提醒默认开：未读通知带"刚刚"标记（真实联动）', async ({ page }) => {
  const drawer = await publishAndOpenCenter(page);
  const item = drawer.locator('li').first();
  await expect(item).toContainText('刚刚');
});

test('关闭 未读提醒：未读行无"刚刚"标记但角标仍计数', async ({ page }) => {
  // 设置 未读提醒 = 关。
  await page.goto('/settings/notifications');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('heading', { name: '通知' }).first().scrollIntoViewIfNeeded();
  const sw = page.getByRole('switch', { name: '未读提醒' });
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(sw).not.toBeChecked();
  await page.waitForTimeout(300);
  const drawer = await publishAndOpenCenter(page);
  const item = drawer.locator('li').first();
  await expect(item).not.toContainText('刚刚');
  // 未读计数仍生效（顶部未读文案或铃铛角标）。
  await expect(drawer).toContainText(/未读|1/);
});
