import { expect, test } from '@playwright/test';
import { readPreviewAccess } from './reading-fixture';

test('角色名称读取失败不阻断本人资料、偏好和会话，重试只恢复角色查询', async ({ page }) => {
  const access = readPreviewAccess();
  let fail = true;
  let attempts = 0;
  let coreReads = 0;
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (
      request.method() === 'GET' &&
      (path.endsWith('/me') || path.endsWith('/iam/session') || path.endsWith('/self/preferences'))
    )
      coreReads += 1;
  });
  await page.route('**/roles?scope=self', async (route) => {
    attempts += 1;
    if (fail) await route.fulfill({ status: 503, json: {} });
    else await route.continue();
  });
  await page.goto('/login?returnTo=%2Faccount');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试', exact: true })).toBeVisible();
  await expect(page.getByLabel('扩展资料', { exact: true })).toBeVisible();
  await expect(page.getByLabel('跨设备账户偏好', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '有效登录会话', exact: true })).toBeVisible();
  expect(attempts).toBe(1);
  const beforeRetry = coreReads;
  fail = false;
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试', exact: true })).toHaveCount(0);
  expect(attempts).toBe(2);
  expect(coreReads).toBe(beforeRetry);
  await expect(page.getByLabel('跨设备账户偏好', { exact: true })).toBeVisible();
});
