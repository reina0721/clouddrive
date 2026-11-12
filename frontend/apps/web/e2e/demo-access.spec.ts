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

test('reset demo data clears custom mock records and returns to sign-in', async ({ page }) => {
  await openLogin(page);
  await page.getByRole('button', { name: /管理员/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/users/create');
  await page.getByLabel('姓名', { exact: true }).fill('重置验收成员');
  await page.getByLabel('邮箱', { exact: true }).fill('reset-check@example.test');
  await page.getByLabel('初始密码', { exact: true }).fill('ResetMemberPassword2026!');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page).toHaveURL(/\/users\/detail\?id=/);
  await page.evaluate(() => window.localStorage.setItem('clouddrive.probe', '1'));
  // 通过账户菜单退出（菜单项是 menuitem，不是 button）。
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: '重置演示数据', exact: true }).click();
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: '重置并退出', exact: true }).click(),
  ]);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: '演示身份快捷登录', exact: true })).toBeVisible();
  // 登录页读取注册策略后可重新播种默认示例；契约是清除自定义数据与会话。
  expect(
    await page.evaluate(() => {
      const raw = localStorage.getItem('clouddrive.auth-mock');
      if (!raw) return { session: null, customUser: false, credentials: 0 };
      const { state } = JSON.parse(raw) as {
        state: { session: unknown; users: { email: string }[]; accounts: unknown[] };
      };
      return {
        session: state.session,
        customUser: state.users.some((user) => user.email === 'reset-check@example.test'),
        credentials: state.accounts.length,
      };
    }),
  ).toEqual({ session: null, customUser: false, credentials: 0 });
  expect(await page.evaluate(() => window.localStorage.getItem('clouddrive.probe'))).toBeNull();
  // 界面偏好不在重置范围内。
  expect(await page.evaluate(() => window.localStorage.getItem('clouddrive.shell'))).not.toBeNull();
  await expect(page.getByRole('heading', { name: '演示身份快捷登录', exact: true })).toBeVisible();
});
