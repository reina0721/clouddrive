import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** 清空偏好 + 设 toastDuration。 */
async function setToastDuration(page: Page, duration: 'short' | 'long') {
  await page.goto('/settings/notifications');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const group = page.getByRole('radiogroup', { name: '非关键成功提示时长' });
  const option = duration === 'short' ? '短' : '长';
  await group.getByText(option, { exact: true }).click();
}

test('提示时长偏好流入 Toast（长=8s：toast 在 6.5s 仍可见）', async ({ page }) => {
  await setToastDuration(page, 'long');
  // 触发真实 toast（feedback showcase 的 overlay=toast 自动通知）。
  await page.goto('/ui-elements/feedback?overlay=toast');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const toast = page.getByText('项目反馈已入队');
  await expect(toast).toBeVisible();
  // 8s 时长：6.5s 后仍应可见（旧 5s 默认会在此时消失——证明偏好已流入）。
  await page.waitForTimeout(6_500);
  await expect(toast).toBeVisible();
});

test('提示时长偏好流入 Toast（短=3s：toast 在 4.5s 消失）', async ({ page }) => {
  await setToastDuration(page, 'short');
  await page.goto('/ui-elements/feedback?overlay=toast');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const toast = page.getByText('项目反馈已入队');
  await expect(toast).toBeVisible();
  // 3s 时长：4.5s 后应已消失。
  await page.waitForTimeout(4_500);
  await expect(toast).not.toBeVisible();
});
