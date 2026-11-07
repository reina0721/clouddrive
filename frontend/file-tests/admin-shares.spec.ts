import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

type Access = { url: string; username: string; password: string };
type Share = { id: string; token: string };

async function readAccess(path: string): Promise<Access> {
  return JSON.parse(
    (await readFile(resolve(__dirname, path), 'utf8')).replace(/^\uFEFF/, ''),
  ) as Access;
}

async function login(page: Page, account: Access, destination: string) {
  const origin = new URL(account.url).origin;
  await page.goto(origin + '/login?returnTo=' + encodeURIComponent(destination));
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(origin + destination);
}

async function fixture<T>(page: Page, path: string, body: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      const { token } = (await (
        await fetch('/api/console/v1/auth/csrf', { cache: 'no-store' })
      ).json()) as { token: string };
      const response = await fetch('/api/console/v1/native/files' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Share fixture failed with HTTP ' + response.status);
      return (await response.json()) as T;
    },
    { path, body },
  );
}

test('跨账号分享筛选、计数详情与窄屏批量撤销', async ({ page, browser }, info) => {
  const adminPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  const memberPath = process.env.CLOUDDRIVE_INVENTORY_MEMBER_ACCESS;
  test.skip(!adminPath || !memberPath, '仅在隔离 QA 验证管理撤销。');
  const [admin, member] = await Promise.all([readAccess(adminPath!), readAccess(memberPath!)]);
  const origin = new URL(admin.url).origin;
  expect(origin).toBe('http://127.0.0.1:4194');
  expect(new URL(member.url).origin).toBe(origin);
  const memberContext = await browser.newContext({ locale: 'zh-CN' });
  try {
    const owner = await memberContext.newPage();
    await login(owner, member, '/home');
    const fileName = `分享验收-${randomUUID().slice(0, 8)}.txt`;
    const entry = await fixture<{ id: string }>(owner, '/text', {
      parentId: '',
      name: fileName,
      key: randomUUID(),
      text: 'share catalog fixture',
    });
    const first = await fixture<Share>(owner, '/shares', { rootId: entry.id, title: '统计验收' });
    const second = await fixture<Share>(owner, '/shares', { rootId: entry.id, title: '批量验收' });
    const link = `${origin}/api/v1/file-shares/${first.token}`;
    const guest = await browser.newContext();
    try {
      expect((await guest.request.get(link)).ok()).toBe(true);
      const grant = await guest.request.post(`${link}/content/${entry.id}/download`, {
        headers: { Origin: origin },
      });
      expect(grant.ok()).toBe(true);
    } finally {
      await guest.close();
    }

    await login(page, admin, '/system-tools/shares');
    await page.getByRole('button', { name: '过滤', exact: true }).click();
    const filters = page.getByRole('dialog', { name: '过滤', exact: true });
    await filters.getByLabel('源文件 ID', { exact: true }).fill(entry.id);
    await filters.getByRole('button', { name: '应用', exact: true }).click();
    const table = page.getByRole('grid', { name: '分享管理', exact: true });
    await expect(table.getByRole('button', { name: fileName, exact: true })).toHaveCount(2);
    const firstRow = table.getByRole('row').filter({ hasText: first.id.slice(0, 8) });
    await firstRow.getByRole('button', { name: fileName, exact: true }).click();
    const detail = page.getByRole('dialog', { name: '分享详情', exact: true });
    await expect(detail.getByText('统计验收', { exact: true })).toBeVisible();
    await expect(detail.getByText('浏览', { exact: true }).locator('..')).toHaveText('浏览1');
    await expect(detail.getByText('下载授权', { exact: true }).locator('..')).toHaveText(
      '下载授权1',
    );
    await expect(detail.getByText(first.token, { exact: true })).toHaveCount(0);
    await detail.getByRole('button', { name: '关闭', exact: true }).click();
    await page.screenshot({
      path: info.outputPath('admin-shares-desktop.png'),
      animations: 'disabled',
    });

    await page.setViewportSize({ width: 320, height: 760 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await firstRow.getByRole('checkbox').press('Space', { timeout: 10000 });
    const secondRow = table.getByRole('row').filter({ hasText: second.id.slice(0, 8) });
    await secondRow.getByRole('checkbox').press('Space', { timeout: 10000 });
    await page.getByRole('button', { name: '撤销选中分享 (2)', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: '撤销分享', exact: true });
    await expect(confirm.getByText(first.id, { exact: false })).toBeVisible();
    await expect(confirm.getByText(second.id, { exact: false })).toBeVisible();
    await page.screenshot({
      path: info.outputPath('admin-shares-mobile.png'),
      animations: 'disabled',
    });
    await confirm.getByRole('button', { name: '撤销分享', exact: true }).click();
    await expect(page.getByText('已撤销 2 个分享', { exact: true })).toBeVisible();
    await expect(table.getByText('已撤销', { exact: true })).toHaveCount(2);
    expect((await page.request.get(link)).status()).toBe(404);
    await owner.goto(origin + '/home?search=' + encodeURIComponent(fileName));
    await expect(owner.getByRole('button', { name: fileName, exact: true })).toBeVisible();
  } finally {
    await memberContext.close();
  }
});
