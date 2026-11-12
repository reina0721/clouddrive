import { expect, test } from '@playwright/test';
import { readPreviewAccess } from './reading-fixture';

test.use({ actionTimeout: 15_000 });

test('会话刷新失败移除旧操作，重试恢复；撤销失败保留确认和读取结果', async ({ page }, info) => {
  const access = readPreviewAccess();
  let failRead = false;
  let revokes = 0;
  const session = {
    createdAt: '2026-11-01T00:00:00.000Z',
    lastActiveAt: '2026-11-11T00:00:00.000Z',
    expiresAt: '2027-11-01T00:00:00.000Z',
  };
  await page.route('**/auth/sessions', (route) =>
    route.fulfill(
      failRead
        ? { status: 503, json: {} }
        : {
            json: {
              items: [
                {
                  ...session,
                  id: 'e25c448c-77bd-4e5a-a117-904b4983f110',
                  device: '验收当前设备',
                  current: true,
                },
                {
                  ...session,
                  id: '80a6db4c-d123-43ac-9967-6fec42e531f3',
                  device: '验收其他设备',
                  current: false,
                },
              ],
            },
          },
    ),
  );
  await page.route('**/auth/sessions/80a6db4c-d123-43ac-9967-6fec42e531f3', (route) => {
    revokes += 1;
    return route.fulfill({ status: 503, json: {} });
  });
  await page.goto('/login?returnTo=%2Faccount');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const section = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '有效登录会话', exact: true }) });
  await expect(section.getByText('验收其他设备', { exact: true })).toBeVisible();
  failRead = true;
  await section.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(section.getByRole('button', { name: '重试', exact: true })).toBeVisible();
  await expect(section.getByText('验收其他设备', { exact: true })).toHaveCount(0);
  await expect(section.getByRole('button', { name: '撤销会话', exact: true })).toHaveCount(0);
  await expect(section.getByRole('button', { name: '退出其他会话', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 320, height: 760 });
  await section.screenshot({
    path: info.outputPath('session-read-failure.png'),
    animations: 'disabled',
  });
  failRead = false;
  await section.getByRole('button', { name: '重试', exact: true }).click();
  await expect(section.getByText('验收其他设备', { exact: true })).toBeVisible();
  await section.getByRole('button', { name: '撤销会话', exact: true }).click();
  const confirm = page.getByRole('alertdialog', { name: '撤销会话', exact: true });
  await confirm.getByRole('button', { name: '确认', exact: true }).click();
  await expect(confirm.getByRole('alert')).toBeVisible();
  expect(revokes).toBe(1);
  await confirm.getByRole('button', { name: '取消', exact: true }).click();
  await expect(section.getByText('验收其他设备', { exact: true })).toBeVisible();
});
