import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetAll(page: Page) {
  await page.goto('/settings/actions');
  await page.evaluate(() => {
    window.localStorage.removeItem('clouddrive.shell');
    window.localStorage.removeItem('clouddrive.page-archetypes.search-history');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

/** 开启 保留最近搜索 + 显示搜索历史（默认均关）。 */
async function enableHistory(page: Page) {
  await page.goto('/settings/actions');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  for (const label of ['保留最近搜索', '显示搜索历史']) {
    const sw = page.getByRole('switch', { name: label });
    await sw.focus();
    await page.keyboard.press('Space');
    await expect(sw).toBeChecked();
  }
  await page.waitForTimeout(300);
}

test('开启后搜索历史记录并显示；清空历史为明确动作', async ({ page }) => {
  await resetAll(page);
  await enableHistory(page);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('searchbox', { name: '搜索 Reference 数据' }).fill('Lin Chen');
  await page.keyboard.press('Enter');
  await expect(page.getByText('最近搜索：')).toBeVisible();
  const clearBtn = page.getByRole('button', { name: '清空搜索历史' });
  await expect(clearBtn).toBeVisible();
  await clearBtn.click();
  await expect(page.getByText('最近搜索：')).not.toBeVisible();
});

test('默认关闭保留最近搜索：执行搜索不记录历史（无历史区）', async ({ page }) => {
  await resetAll(page);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await page.getByRole('searchbox', { name: '搜索 Reference 数据' }).fill('Lin Chen');
  await page.keyboard.press('Enter');
  await expect(page.getByText('最近搜索：')).not.toBeVisible();
});
