import { expect, test } from '@playwright/test';

test('连续导航：快速依次跳转多个页面全部成功且无错误边界', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const nav = page.getByRole('navigation', { name: '主导航' });
  const targets = ['参考资源', '个人偏好', '工作台', '参考资源'];
  for (const label of targets) {
    await nav.getByRole('link', { name: label, exact: true }).click();
    // 每个目标都应真正切换（无错误边界 / 卡死）。
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    await page.waitForTimeout(120);
  }
  // 最终落在参考资源页且内容区可见（非错误边界）。
  await expect(page).toHaveURL(/\/reference-resources/);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Application error');
});

test('连续导航含离开确认：快速导航不被脏表单残留卡死', async ({ page }) => {
  await page.goto('/reference-resources/edit?id=resource-alpha');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // 制造脏表单但不触发离开确认的导航路径：直接 SPA 切到列表（应用内链接会先确认）。
  await page.getByLabel('名称').fill('脏值');
  const nav = page.getByRole('navigation', { name: '主导航' });
  await nav.getByRole('link', { name: '参考资源', exact: true }).click();
  // 离开确认出现 → 确认离开。
  const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '离开' }).click();
  await expect(page).toHaveURL(/\/reference-resources$/);
  // 随后连续导航仍正常。
  await nav.getByRole('link', { name: '个人偏好', exact: true }).click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole('main')).toBeVisible();
});
