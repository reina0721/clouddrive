import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** 清空偏好（clouddrive.shell），保证每次测试从默认开始（confirmLeave 默认开）。 */
async function resetPreferences(page: Page) {
  await page.goto('/settings/actions');
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.shell'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

test('参考资源编辑：未保存修改离开时弹出确认；取消留在原地，确认后离开', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/reference-resources/edit?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const nameInput = page.getByLabel('名称');
  await nameInput.fill('Alpha 改名测试');
  // 点“取消/返回详情”导航 → 离开确认弹窗。
  await page.getByRole('link', { name: '返回详情' }).click();
  await expect(page.getByRole('heading', { name: '离开当前页面？' })).toBeVisible();
  // 取消 → 留在编辑页（URL 未变、无导航）。
  await page.getByRole('alertdialog').getByRole('button', { name: '取消', exact: true }).click();
  await expect(page).toHaveURL(/\/reference-resources\/edit/);
  // 再次离开 → 确认 → 导航到详情页。
  await page.getByRole('link', { name: '返回详情' }).click();
  await page.getByRole('button', { name: '离开', exact: true }).click();
  await expect(page).toHaveURL(/\/reference-resources\/detail/);
});

test('操作偏好关闭「离开未保存内容时提醒」后，dirty 离开不再弹确认', async ({ page }) => {
  await resetPreferences(page);
  // 关闭 操作偏好 → 离开未保存内容时提醒。
  await page.goto('/settings/actions');
  await page.getByRole('heading', { name: '操作偏好' }).first().scrollIntoViewIfNeeded();
  const leaveSwitch = page.getByRole('switch', { name: '离开未保存内容时提醒' });
  await leaveSwitch.focus();
  await page.keyboard.press('Space');
  await expect(leaveSwitch).not.toBeChecked();

  // 编辑页 dirty → 点返回详情 → 不弹确认直接离开。
  await page.goto('/reference-resources/edit?id=resource-alpha');
  await page.getByLabel('名称').fill('Beta 改名测试');
  await page.getByRole('link', { name: '返回详情' }).click();
  await expect(page).toHaveURL(/\/reference-resources\/detail/);
});
