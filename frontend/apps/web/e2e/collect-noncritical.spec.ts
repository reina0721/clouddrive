import { expect, test } from '@playwright/test';
import { e2eBaseUrl } from './base-url';

test('收纳非关键通知默认开：复制反馈同时进通知中心', async ({ page }) => {
  await page.goto('/reference-resources/detail?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 触发复制反馈（clipboard 权限需授予）。
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: e2eBaseUrl,
  });
  await page.getByRole('button', { name: '复制 ID' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /通知/ }).first().click();
  const drawer = page.getByRole('dialog', { name: '通知中心' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('资源 ID 已复制到剪贴板').first()).toBeVisible();
});

test('关闭 收纳非关键通知：复制反馈仅 toast 不进中心', async ({ page }) => {
  await page.goto('/settings/notifications');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('heading', { name: '通知' }).first().scrollIntoViewIfNeeded();
  const sw = page.getByRole('switch', { name: '收纳非关键通知到通知中心' });
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(sw).not.toBeChecked();
  await page.waitForTimeout(300);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: e2eBaseUrl,
  });
  await page.goto('/reference-resources/detail?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('button', { name: '复制 ID' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /通知/ }).first().click();
  const drawer = page.getByRole('dialog', { name: '通知中心' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('资源 ID 已复制到剪贴板')).not.toBeVisible();
});
