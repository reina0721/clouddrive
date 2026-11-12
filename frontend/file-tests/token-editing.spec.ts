import { expect, test } from '@playwright/test';
import { readPreviewAccess } from './reading-fixture';

test('令牌编辑显示现有权限，冲突保留输入且更新不修改权限', async ({ page }, info) => {
  const access = readPreviewAccess();
  const id = '98af7405-b7c7-452a-88c8-69986836e0f4';
  const token = {
    id,
    version: 2,
    name: '编辑验收',
    scopes: ['files:read'],
    description: '原说明',
    status: 'active',
    createdAt: '2026-11-01T00:00:00Z',
  };
  await page.route('**/native/iam/api-tokens?**', (route) =>
    route.fulfill({ json: { items: [token], total: 1 } }),
  );
  let writes = 0;
  await page.route(`**/native/iam/api-tokens/${id}`, async (route) => {
    expect(route.request().method()).toBe('PATCH');
    expect(route.request().headers()['if-match']).toBe('"2"');
    expect(route.request().postDataJSON()).toEqual({
      name: '新名称',
      description: '原说明',
      neverExpires: true,
    });
    writes += 1;
    await route.fulfill({ status: 409, json: { code: 'conflict' } });
  });
  await page.goto('/login?returnTo=%2Faccount%2Ftokens');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'API 令牌', exact: true });
  await expect(dialog.getByLabel('权限键（逗号分隔）')).toHaveValue('files:read');
  await expect(dialog.getByLabel('权限键（逗号分隔）')).toBeDisabled();
  await dialog.getByLabel('名称', { exact: true }).fill('   ');
  await expect(dialog.getByRole('button', { name: '确认', exact: true })).toBeDisabled();
  await dialog.getByLabel('名称', { exact: true }).fill(' 新名称 ');
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('数据发生冲突');
  await expect(dialog.getByLabel('名称', { exact: true })).toHaveValue(' 新名称 ');
  expect(writes).toBe(1);
  await page.setViewportSize({ width: 320, height: 760 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({
    path: info.outputPath('token-conflict-mobile.png'),
    animations: 'disabled',
  });
});
