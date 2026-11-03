import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function openAccessibility(page: Page) {
  await page.goto('/settings/accessibility');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('heading', { name: '可访问性' }).first().scrollIntoViewIfNeeded();
}

async function toggleSwitch(page: Page, name: string, on: boolean) {
  const sw = page.getByRole('switch', { name });
  await sw.focus();
  await page.keyboard.press('Space');
  if (on) await expect(sw).toBeChecked();
  else await expect(sw).not.toBeChecked();
}

test('增强焦点轮廓：开启写入 data-enhance-focus 且焦点环 Token 加强', async ({ page }) => {
  await openAccessibility(page);
  await toggleSwitch(page, '增强焦点轮廓', true);
  await page.waitForTimeout(300);
  await expect(page.locator('html')).toHaveAttribute('data-enhance-focus', 'on');
  const ring = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--spacing-focus-ring-width')
      .trim(),
  );
  expect(ring).toBe('.25rem');
});

test('增强交互区域尺寸：开启写入 data-enhance-target 且控件 spacing 放大', async ({ page }) => {
  await openAccessibility(page);
  await toggleSwitch(page, '增强交互区域尺寸', true);
  await page.waitForTimeout(300);
  await expect(page.locator('html')).toHaveAttribute('data-enhance-target', 'on');
  const spacing = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--spacing-control').trim(),
  );
  expect(spacing).toBe('3.25rem');
});

test('跟随系统辅助设置：开启写入 data-follow-system 并同步系统对比度', async ({ page }) => {
  await openAccessibility(page);
  await toggleSwitch(page, '跟随操作系统辅助功能设置', false); // 先确保关
  await toggleSwitch(page, '跟随操作系统辅助功能设置', true);
  await page.waitForTimeout(300);
  await expect(page.locator('html')).toHaveAttribute('data-follow-system', 'on');
  // Playwright 默认 prefers-contrast: no-preference → standard。
  await expect(page.locator('html')).toHaveAttribute('data-system-contrast', 'standard');
  // 外观仍为 system 时，独立的对比度偏好继续监听系统。
  await toggleSwitch(page, '跟随操作系统辅助功能设置', false);
  await page.waitForTimeout(300);
  await expect(page.locator('html')).toHaveAttribute('data-follow-system', 'off');
  await expect(page.locator('html')).toHaveAttribute('data-system-contrast', 'standard');
  await page.goto('/settings');
  const contrast = page.getByRole('radiogroup', { name: '高对比度', exact: true });
  await contrast.getByRole('radio', { name: '跟随系统', exact: true }).press('ArrowRight');
  await expect(contrast.getByRole('radio', { name: '标准', exact: true })).toBeChecked();
  // 两个系统偏好入口都关闭时才清除监听结果。
  await expect(page.locator('html')).not.toHaveAttribute('data-system-contrast');
});
