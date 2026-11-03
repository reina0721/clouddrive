import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

test.use({
  permissions: ['clipboard-read', 'clipboard-write'],
});

async function resetPreferences(page: Page) {
  await page.goto('/settings/actions');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('复制后反馈（copyFeedback 默认开）：复制 ID → 成功 Toast', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/reference-resources/detail?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: '复制 ID' }).click();
  await expect(page.getByText('资源 ID 已复制到剪贴板')).toBeVisible();
  await expect(page.getByRole('button', { name: '已复制' })).toBeVisible();
});

test('关闭 复制后显示反馈：复制 ID 不再弹 Toast', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 操作偏好 → 复制后显示反馈 = 关。
  await page.goto('/settings/actions');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  const copyFeedback = page.getByRole('switch', { name: '复制后显示反馈' });
  await copyFeedback.focus();
  await page.keyboard.press('Space');
  await expect(copyFeedback).not.toBeChecked();
  await page.waitForTimeout(300);

  await page.goto('/reference-resources/detail?id=resource-alpha');
  await page.getByRole('button', { name: '复制 ID' }).click();
  await expect(page.getByRole('button', { name: '已复制' })).toBeVisible();
  await expect(page.getByText('资源 ID 已复制到剪贴板')).not.toBeVisible();
});
