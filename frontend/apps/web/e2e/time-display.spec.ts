import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function publishAndOpenCenter(page: Page) {
  // 编辑保存发布真实通知。
  await page.goto('/reference-resources/edit?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: /保存/ }).first().click();
  await page.waitForTimeout(500);
  // 打开通知中心。
  await page.getByRole('button', { name: /通知/ }).first().click();
  const drawer = page.locator('[role="dialog"], [role="alertdialog"]');
  await expect(drawer).toBeVisible();
  return drawer;
}

test('通知条目显示时刻（默认 24 小时）', async ({ page }) => {
  const drawer = await publishAndOpenCenter(page);
  // 时间 caption 存在且匹配 24h（HH:MM 或 HH:MM:SS）。
  const timeText = await drawer.locator('li').first().locator('span').last().innerText();
  expect(timeText).toMatch(/\d{1,2}:\d{2}/);
  expect(timeText).not.toMatch(/AM|PM/);
});

test('12 小时制：通知条目时刻带 AM/PM（真实联动）', async ({ page }) => {
  // 设置 12 小时制。
  await page.goto('/settings/locale');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('heading', { name: '语言与地区' }).first().scrollIntoViewIfNeeded();
  await page
    .getByRole('radiogroup', { name: '时间格式' })
    .getByText('12 小时制', { exact: true })
    .click();
  await page.waitForTimeout(300);
  const drawer = await publishAndOpenCenter(page);
  const timeText = await drawer.locator('li').first().locator('span').last().innerText();
  expect(timeText).toMatch(/\d{1,2}:\d{2}/);
  expect(timeText).toMatch(/AM|PM|上午|下午/);
});
