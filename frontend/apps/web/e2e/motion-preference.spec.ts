import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetPreferences(page: Page) {
  await page.goto('/settings');
  await page.evaluate(() => {
    window.localStorage.removeItem('clouddrive.shell');
    window.sessionStorage.removeItem('clouddrive.motion-inspector');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function motionMode(page: Page): Promise<string | null> {
  return page.evaluate(() => document.documentElement.dataset.motionMode ?? null);
}

async function pickMotion(page: Page, label: string) {
  await page.goto('/settings');
  await page.getByRole('heading', { name: '外观' }).first().scrollIntoViewIfNeeded();
  await page
    .getByRole('radiogroup', { name: '动效偏好' })
    .getByText(label, { exact: true })
    .click();
  await page.waitForTimeout(400);
}

test('动效偏好默认跟随系统：data-motion-mode 为 system（Inspector/OS 决定）', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  expect(await motionMode(page)).toBe('system');
});

test('动效偏好=减少动效：data-motion-mode 硬设为 reduced', async ({ page }) => {
  await resetPreferences(page);
  await pickMotion(page, '减少动效');
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  expect(await motionMode(page)).toBe('reduced');
});

test('动效偏好=标准动效：data-motion-mode 硬设为 full', async ({ page }) => {
  await resetPreferences(page);
  await pickMotion(page, '标准');
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  expect(await motionMode(page)).toBe('full');
});
