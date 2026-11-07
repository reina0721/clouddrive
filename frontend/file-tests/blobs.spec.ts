import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, account: { username: string; password: string }) {
  await page.goto('/login?returnTo=%2Fworkspace');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/workspace$/);
}

test('文件 Blob 按对象显示真实引用并保护管理入口', async ({ page, browser }, testInfo) => {
  const memberPath = process.env.CLOUDDRIVE_INVENTORY_MEMBER_ACCESS;
  test.skip(!memberPath, 'Blob 验证使用独立验收账号。');
  const readAccess = async (path: string) =>
    JSON.parse((await readFile(resolve(__dirname, path), 'utf8')).replace(/^\uFEFF/, '')) as {
      username: string;
      password: string;
      url: string;
      purpose?: string;
    };
  const member = await readAccess(memberPath!);
  const admin = await readAccess(
    process.env.CLOUDDRIVE_FILE_TEST_ACCESS ?? '../../.data/preview-access.json',
  );
  const origin = new URL(member.url).origin;
  expect(member.purpose).toBe('direct-links-fixture');
  expect(origin).toBe('http://127.0.0.1:4194');
  expect(new URL(admin.url).origin).toBe(origin);
  await login(page, member);
  await expect(page.getByRole('link', { name: '文件 Blob', exact: true })).toHaveCount(0);
  await page.goto('/system-tools/blobs');
  await expect(
    page.getByRole('alert').filter({ hasText: '当前账户没有文件操作权限' }),
  ).toBeVisible();
  const suffix = randomUUID().slice(0, 8);
  const original = 'Blob 验收-' + suffix + '.txt';
  const copy = 'Blob 副本-' + suffix + '.txt';
  const id = await page.evaluate(
    async ({ original, copy, key }) => {
      const csrf = await fetch('/api/console/v1/auth/csrf', { cache: 'no-store' });
      const { token } = (await csrf.json()) as { token: string };
      const call = async (path: string, method: string, body: object) => {
        const response = await fetch('/api/console/v1/native/files' + path, {
          method,
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error('Blob fixture failed with HTTP ' + response.status);
        return (await response.json()) as { id: string };
      };
      const file = await call('/text', 'POST', {
        parentId: '',
        name: original,
        text: '旧对象',
        key,
      });
      await call('/' + file.id + '/copy', 'POST', { parentId: '', name: copy });
      await call('/' + file.id + '/text', 'PUT', { expectedRevision: 1, text: '新对象' });
      return file.id;
    },
    { original, copy, key: randomUUID() },
  );

  const adminContext = await browser.newContext({ baseURL: origin, locale: 'zh-CN' });
  try {
    const adminPage = await adminContext.newPage();
    await login(adminPage, admin);
    const ownerID = await adminPage.evaluate(async (fileId) => {
      const response = await fetch('/api/console/v1/native/files/inventory/' + fileId, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Owner lookup failed with HTTP ' + response.status);
      return ((await response.json()) as { ownerId: string }).ownerId;
    }, id);
    await adminPage.getByRole('link', { name: '文件 Blob', exact: true }).click();
    await expect(adminPage).toHaveURL(/\/system-tools\/blobs$/);
    const filter = adminPage.getByRole('button', { name: '过滤', exact: true });
    const dialog = adminPage.getByRole('dialog', { name: '过滤', exact: true });
    await filter.click();
    const owner = dialog.getByLabel('引用所有者 ID', { exact: true });
    await owner.fill('nonexistent-owner');
    await dialog.getByRole('button', { name: '应用', exact: true }).click();
    await expect(adminPage.getByText('没有符合条件的 Blob', { exact: true })).toBeVisible();
    await filter.click();
    await owner.fill(ownerID);
    await expect(dialog.getByText('存储策略', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: '应用', exact: true }).click();
    const row = adminPage.getByRole('button', { name: id, exact: true });
    await expect(row).toBeVisible();
    await adminPage.getByRole('button', { name: '刷新', exact: true }).click();
    await expect(row).toBeVisible();
    await adminPage.screenshot({ path: testInfo.outputPath('blobs-desktop.png') });
    await adminPage.setViewportSize({ width: 320, height: 760 });
    await row.click();
    const detail = adminPage.getByRole('dialog', { name: 'Blob 详情', exact: true });
    await expect(detail).toContainText('对象存在于主存储');
    await expect(detail).toContainText(original);
    await expect(detail).toContainText(copy);
    await expect(detail.getByRole('link')).toHaveCount(0);
    expect(await detail.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      false,
    );
    await adminPage.screenshot({ path: testInfo.outputPath('blobs-mobile.png') });
    await detail.getByRole('button', { name: '关闭', exact: true }).click();
    await filter.click();
    await dialog.getByRole('button', { name: '重置', exact: true }).click();
    await filter.click();
    await expect(owner).toHaveValue('');
    const workspace = adminPage.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/api-workbench/workspace') &&
        response.request().method() === 'GET',
    );
    await adminPage.goto('/api-workbench');
    expect((await workspace).ok()).toBeTruthy();
  } finally {
    await adminContext.close();
  }
});
