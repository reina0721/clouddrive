import { expect, test } from '@playwright/test';

test('同路由 no-op：点击当前页侧栏链接不重复导航（URL 不变）', async ({ page }) => {
  await page.goto('/reference-resources');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const nav = page.getByRole('navigation', { name: '主导航' });
  const current = nav.getByRole('link', { name: '参考资源', exact: true });
  await current.click();
  // 仍在同一 URL（无重复 push/重载）。
  await expect(page).toHaveURL(/\/reference-resources$/);
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(/\/reference-resources$/);
});

test('浏览器返回：SPA 导航后返回上一页且内容正确', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  // SPA 前进到设置。
  const nav = page.getByRole('navigation', { name: '主导航' });
  await nav.getByRole('link', { name: '个人偏好', exact: true }).click();
  await page.waitForURL(/\/settings/);
  await expect(page.getByRole('heading', { level: 1, name: '外观' })).toBeVisible();
  // 浏览器返回 → 回到首页。
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('工作台');
});

// 注：浏览器历史返回的脏表单离开确认不在应用内 leave-confirm 覆盖范围（已确认
// 平台限制：浏览器关闭/历史导航/进程终止接受原生限制 + 草稿恢复）；应用内导航的
// 离开确认由 leave-confirm.spec 覆盖。
