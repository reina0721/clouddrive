import { expect, test } from '@playwright/test';
import { readPreviewAccess } from './reading-fixture';

for (const scenario of [
  { name: '无自助权限', permissions: [], reads: 0, manage: false, archive: false },
  {
    name: '只读本人状态',
    permissions: ['iam:account:self:read'],
    reads: 1,
    manage: false,
    archive: false,
  },
  {
    name: '可管理本人认证',
    permissions: ['iam:account:self:read', 'iam:account:self:password:write'],
    reads: 1,
    manage: true,
    archive: false,
  },
  {
    name: '仅允许注销本人',
    permissions: ['iam:account:self:archive'],
    reads: 0,
    manage: false,
    archive: true,
  },
]) {
  test(`安全页权限边界：${scenario.name}`, async ({ page }, info) => {
    const access = readPreviewAccess();
    let reads = 0;
    await page.route('**/auth/access', async (route) => {
      const response = await route.fetch();
      const value = (await response.json()) as Record<string, unknown>;
      await route.fulfill({ json: { ...value, nativePermissions: scenario.permissions } });
    });
    await page.route('**/native/iam/self/mfa', (route) => {
      reads += 1;
      return route.fulfill({ json: { registered: false } });
    });
    await page.goto('/login?returnTo=%2Faccount%2Fsecurity');
    await page.getByLabel('邮箱', { exact: true }).fill(access.username);
    await page.getByLabel('密码', { exact: true }).fill(access.password);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page).toHaveURL(/\/account\/security$/);
    await expect(
      page.getByRole('heading', { name: '安全设置', exact: true }).first(),
    ).toBeVisible();
    if (scenario.reads)
      await expect(page.getByRole('heading', { name: '双因素认证', exact: true })).toBeVisible();
    else if (scenario.archive)
      await expect(page.getByRole('button', { name: '注销账户', exact: true })).toBeVisible();
    else await expect(page.getByText('没有操作权限', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '绑定认证器', exact: true })).toHaveCount(
      scenario.manage ? 1 : 0,
    );
    await expect(page.getByRole('button', { name: '注销账户', exact: true })).toHaveCount(
      scenario.archive ? 1 : 0,
    );
    expect(reads).toBe(scenario.reads);
    await page.setViewportSize({ width: 320, height: 760 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({
      path: info.outputPath('security-access-mobile.png'),
      animations: 'disabled',
    });
  });
}
