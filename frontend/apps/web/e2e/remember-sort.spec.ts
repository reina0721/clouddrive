import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

async function resetAll(page: Page) {
  await page.goto('/settings/data-display');
  await page.evaluate(() => {
    window.localStorage.removeItem('clouddrive.shell');
    window.localStorage.removeItem('clouddrive.page-archetypes.column-layout');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function sortByWorkstream(page: Page) {
  await page.getByRole('columnheader', { name: /工作流/ }).click();
  await expect(page.getByRole('columnheader', { name: /工作流/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
}

test('记住排序条件默认关：排序后重载回默认', async ({ page }) => {
  await resetAll(page);
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await sortByWorkstream(page);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('columnheader', { name: /工作流/ })).not.toHaveAttribute(
    'aria-sort',
    'ascending',
  );
});

test('开启 记住排序条件：排序后重载仍保持', async ({ page }) => {
  await resetAll(page);
  // 设置 → 数据展示 → 记住排序条件 = 开。
  await page.goto('/settings/data-display');
  await page.getByRole('heading', { name: '数据展示' }).first().scrollIntoViewIfNeeded();
  const rememberSort = page.getByRole('switch', { name: '记住排序条件' });
  await rememberSort.focus();
  await page.keyboard.press('Space');
  await expect(rememberSort).toBeChecked();
  await page.waitForTimeout(300);

  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await sortByWorkstream(page);
  await page.waitForTimeout(400);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('columnheader', { name: /工作流/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
});
