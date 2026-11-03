import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetPreferences(page: Page) {
  await page.goto('/settings/actions');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function activeElementId(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.id ?? null);
}

test('首错误聚焦默认开：清空必填并提交 → 焦点落在首个错误字段', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/page-archetypes/create-edit');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const nameInput = page.getByLabel('名称');
  await nameInput.fill('x'); // 少于 min(3) → 校验失败
  await page.getByRole('button', { name: '保存草稿' }).click();
  // 错误字段出现且焦点在名称输入框（RHF shouldFocusError）。
  const inputId = await nameInput.getAttribute('id');
  await expect.poll(() => activeElementId(page), { timeout: 3_000 }).toBe(inputId);
});

test('关闭 定位首个错误字段：提交后不自动聚焦错误字段', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 操作偏好 → 定位首个错误字段 = 关。
  await page.goto('/settings/actions');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  const focusError = page.getByRole('switch', { name: '定位首个错误字段' });
  await focusError.focus();
  await page.keyboard.press('Space');
  await expect(focusError).not.toBeChecked();
  await page.waitForTimeout(300);

  await page.goto('/page-archetypes/create-edit');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const nameInput = page.getByLabel('名称');
  await nameInput.fill('x');
  await page.getByRole('button', { name: '保存草稿' }).click();
  // 焦点不应落在名称输入框（关闭聚焦）。
  const inputId = await nameInput.getAttribute('id');
  await page.waitForTimeout(800);
  const activeId = await activeElementId(page);
  expect(activeId).not.toBe(inputId);
});
