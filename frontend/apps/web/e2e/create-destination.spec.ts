import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** 清空偏好。 */
async function resetPreferences(page: Page) {
  await page.goto('/settings/actions');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('创建成功去向默认返回列表（操作偏好 → createSuccessDestination）', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/reference-resources/create');
  await page.getByLabel('名称').fill('去向测试');
  await page.getByRole('button', { name: '创建' }).click();
  await expect(page).toHaveURL(/\/reference-resources$/);
});

test('创建成功去向=继续创建：提交后留在本页并清空表单', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 操作偏好 → 创建成功后去向 = 继续创建。
  await page.goto('/settings/actions');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  await page
    .getByRole('radiogroup', { name: '创建成功后去向' })
    .getByText('继续创建', { exact: true })
    .click();
  await page.waitForTimeout(300);

  await page.goto('/reference-resources/create');
  await page.getByLabel('名称').fill('继续创建测试');
  await page.getByRole('button', { name: '创建' }).click();
  // 留在创建页，表单已清空（可继续录入）。
  await expect(page).toHaveURL(/\/reference-resources\/create/);
  await expect(page.getByLabel('名称')).toHaveValue('');
});
