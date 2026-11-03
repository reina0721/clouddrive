import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetPreferences(page: Page) {
  await page.goto('/settings/data-display');
  await page.evaluate(() => {
    window.localStorage.removeItem('clouddrive.shell');
    window.localStorage.removeItem('clouddrive.workspace');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function goToPage3(page: Page) {
  await page.getByRole('button', { name: '第 3 页' }).click();
  await expect(page.getByRole('button', { name: '第 3 页' })).toHaveAttribute(
    'data-active',
    'true',
  );
}

async function awayAndBack(page: Page) {
  // 离开列表（完整重载模拟跨页面往返）→ 返回列表。
  await page.goto('/settings/data-display');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('记住分页位置默认关：离开再回列表回到第 1 页', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await goToPage3(page);
  await awayAndBack(page);
  await expect(page.getByRole('button', { name: '第 1 页' })).toHaveAttribute(
    'data-active',
    'true',
  );
});

test('开启 记住分页位置：离开再回列表仍在第 3 页', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 数据展示 → 记住分页位置 = 开。
  await page.goto('/settings/data-display');
  await page.getByRole('heading', { name: '数据展示' }).first().scrollIntoViewIfNeeded();
  const remember = page.getByRole('switch', { name: '记住分页位置' });
  await remember.focus();
  await page.keyboard.press('Space');
  await expect(remember).toBeChecked();
  await page.waitForTimeout(300);

  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await goToPage3(page);
  await awayAndBack(page);
  await expect(page.getByRole('button', { name: '第 3 页' })).toHaveAttribute(
    'data-active',
    'true',
  );
});
