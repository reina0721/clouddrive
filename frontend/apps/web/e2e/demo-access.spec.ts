import { test, expect, type Page } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

async function openLogin(page: Page) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '演示身份快捷登录', exact: true })).toBeVisible();
}

test('demo identities sign in with the real role and land on the workspace', async ({ page }) => {
  await openLogin(page);
  const operator = page.getByRole('button', { name: /操作员/ });
  await expect(operator).toBeVisible();
  await operator.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
  // 操作员没有 settings.read：系统配置入口不出现（权限来自既有 RBAC，不是界面假设）。
  await expect(page.getByRole('link', { name: '系统配置', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '用户管理', exact: true })).toBeVisible();
});

test('restricted member sees a reduced navigation instead of admin entries', async ({ page }) => {
  await openLogin(page);
  await page.getByRole('button', { name: /受限成员/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: '用户管理', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '角色管理', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '个人账户', exact: true })).toBeVisible();
});

test('reset demo data clears the mock directory and returns to sign-in', async ({ page }) => {
  await openLogin(page);
  await page.getByRole('button', { name: /管理员/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.evaluate(() => window.localStorage.setItem('clouddrive.probe', '1'));
  // 通过账户菜单退出（菜单项是 menuitem，不是 button）。
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: '重置演示数据', exact: true }).click();
  await page.getByRole('button', { name: '重置并退出', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('clouddrive.auth-mock')))
    .toBeNull();
  expect(await page.evaluate(() => window.localStorage.getItem('clouddrive.probe'))).toBeNull();
  // 界面偏好不在重置范围内。
  expect(await page.evaluate(() => window.localStorage.getItem('clouddrive.shell'))).not.toBeNull();
  await expect(page.getByRole('heading', { name: '演示身份快捷登录', exact: true })).toBeVisible();
});
