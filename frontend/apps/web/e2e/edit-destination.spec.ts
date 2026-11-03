import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** 清空偏好。 */
async function resetPreferences(page: Page) {
  await page.goto('/settings/actions');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('编辑成功去向默认留在当前页（操作偏好 → editSuccessDestination=stay）', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/reference-resources/edit?id=resource-alpha');
  await page.getByLabel('名称').fill('去向测试改');
  await page.getByRole('button', { name: '保存' }).click();
  // 留在编辑页（stay 默认）。
  await expect(page).toHaveURL(/\/reference-resources\/edit\?id=resource-alpha$/);
  // 保存后不再 dirty：直接点返回详情不弹离开确认。
  await page.getByRole('link', { name: '返回详情' }).click();
  await expect(page).toHaveURL(/\/reference-resources\/detail/);
});

test('编辑成功去向=进入详情：保存后导航详情', async ({ page }) => {
  await resetPreferences(page);
  // 设置 → 操作偏好 → 编辑成功后去向 = 进入详情。
  await page.goto('/settings/actions');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  await page
    .getByRole('radiogroup', { name: '编辑成功后去向' })
    .getByText('进入详情', { exact: true })
    .click();
  await page.waitForTimeout(300);

  await page.goto('/reference-resources/edit?id=resource-alpha');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page).toHaveURL(/\/reference-resources\/detail/);
});
