import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { z } from 'zod';

const legacyPreferenceFixture = z
  .object({
    state: z
      .object({
        preferences: z
          .object({
            navigation: z.object({ autoRestoreWorkspace: z.boolean() }).passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

async function resetAll(page: Page) {
  await page.goto('/settings/navigation');
  await page.evaluate(() => {
    window.localStorage.removeItem('clouddrive.shell');
    window.localStorage.removeItem('clouddrive.workspace');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function enableAutosave(page: Page) {
  await page.goto('/settings/actions');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  const sw = page.getByRole('switch', { name: '本地草稿自动保存' });
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(sw).toBeChecked();
  await page.waitForTimeout(300);
}

test('自动恢复未完成工作默认关：有草稿时进入首页不重定向', async ({ page }) => {
  await resetAll(page);
  await enableAutosave(page);
  // 输入草稿后回首页。
  await page.goto('/reference-resources/create');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByLabel('名称').fill('未完成的工作草稿');
  await page.waitForTimeout(400);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.waitForTimeout(600);
  await expect(page).not.toHaveURL(/reference-resources\/create/);
});

test('旧自动恢复偏好保留兼容，但首页不跳转且草稿仍可手动恢复', async ({ page }) => {
  await resetAll(page);
  await enableAutosave(page);
  const raw: unknown = JSON.parse(
    await page.evaluate(() => localStorage.getItem('clouddrive.shell') ?? '{}'),
  );
  const stored = legacyPreferenceFixture.parse(raw);
  stored.state.preferences.navigation.autoRestoreWorkspace = true;
  await page.evaluate((fixture) => {
    localStorage.setItem('clouddrive.shell', JSON.stringify(fixture));
  }, stored);
  await page.goto('/reference-resources/create');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByLabel('名称').fill('未完成的工作草稿');
  await page.waitForTimeout(400);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: '工作台', level: 1 })).toBeVisible();
  await page.goto('/reference-resources/create');
  await expect(page.getByLabel('名称')).toHaveValue('未完成的工作草稿');
});
