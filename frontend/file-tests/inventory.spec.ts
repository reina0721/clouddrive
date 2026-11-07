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

test('管理清单隔离权限、过滤和窄屏详情', async ({ page, browser }, testInfo) => {
  const accessPath = process.env.CLOUDDRIVE_INVENTORY_MEMBER_ACCESS;
  test.skip(!accessPath, '清单测试需指定隔离验收账号。');
  const readAccess = async (path: string) =>
    JSON.parse((await readFile(resolve(__dirname, path), 'utf8')).replace(/^\uFEFF/, '')) as {
      username: string;
      password: string;
      url: string;
      purpose?: string;
    };
  const member = await readAccess(accessPath!);
  const admin = await readAccess(
    process.env.CLOUDDRIVE_FILE_TEST_ACCESS ?? '../../.data/preview-access.json',
  );
  const origin = new URL(member.url).origin;
  expect(member.purpose).toBe('direct-links-fixture');
  expect(origin).toBe('http://127.0.0.1:4194');
  expect(new URL(admin.url).origin).toBe(origin);
  await login(page, member);
  await expect(page.getByRole('link', { name: '文件清单', exact: true })).toHaveCount(0);
  await page.goto('/system-tools/files');
  await expect(
    page.getByRole('alert').filter({ hasText: '当前账户没有文件操作权限' }),
  ).toBeVisible();
  const name = '管理清单验收-' + randomUUID().slice(0, 8) + '.txt';
  const createStatus = await page.evaluate(
    async ({ name, key }) => {
      const csrf = await fetch('/api/console/v1/auth/csrf', { cache: 'no-store' });
      const { token } = (await csrf.json()) as { token: string };
      const response = await fetch('/api/console/v1/native/files/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ parentId: '', name, text: '真实管理清单', key }),
      });
      return response.status;
    },
    { name, key: randomUUID() },
  );
  expect(createStatus).toBe(200);

  const adminContext = await browser.newContext({ baseURL: origin, locale: 'zh-CN' });
  try {
    const adminPage = await adminContext.newPage();
    await login(adminPage, admin);
    await adminPage.getByRole('link', { name: '文件清单', exact: true }).click();
    await expect(adminPage).toHaveURL(/\/system-tools\/files$/);
    const filter = adminPage.getByRole('button', { name: '过滤', exact: true });
    const dialog = adminPage.getByRole('dialog', { name: '过滤', exact: true });
    await filter.click();
    await dialog.getByLabel('搜索文件名', { exact: true }).fill('no-results-' + randomUUID());
    await dialog.getByRole('button', { name: '应用', exact: true }).click();
    await expect(adminPage.getByText('没有符合条件的文件', { exact: true })).toBeVisible();
    await filter.click();
    await dialog.getByLabel('搜索文件名', { exact: true }).fill(name);
    await dialog.getByRole('button', { name: '应用', exact: true }).click();
    const row = adminPage.getByRole('button', { name, exact: true });
    await expect(row).toBeVisible();
    await expect(adminPage.getByText('第 1 / 1 页，共 1 项', { exact: true })).toBeVisible();
    await adminPage.getByRole('button', { name: '刷新', exact: true }).click();
    await expect(row).toBeVisible();
    await adminPage.screenshot({ path: testInfo.outputPath('inventory-desktop.png') });
    await adminPage.setViewportSize({ width: 320, height: 760 });
    await row.click();
    const detail = adminPage.getByRole('dialog', { name: '文件详情', exact: true });
    await expect(detail).toContainText(name);
    await expect(detail).toContainText('历史版本数');
    await expect(detail).toContainText('逻辑占用');
    await expect(detail.getByRole('link')).toHaveCount(0);
    const overflow = await detail.evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(overflow).toBe(false);
    await adminPage.screenshot({ path: testInfo.outputPath('inventory-mobile.png') });
    const lastField = detail.getByText('存在直链', { exact: true });
    await lastField.scrollIntoViewIfNeeded();
    await expect(lastField).toBeInViewport();
    await detail.getByRole('button', { name: '关闭', exact: true }).click();
    await filter.click();
    await dialog.getByRole('button', { name: '重置', exact: true }).click();
    await filter.click();
    await expect(dialog.getByLabel('搜索文件名', { exact: true })).toHaveValue('');
  } finally {
    await adminContext.close();
  }
});
