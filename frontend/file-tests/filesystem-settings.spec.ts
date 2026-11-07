import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

type SettingsResponse = {
  revision: number;
  overrides: Record<string, number | boolean>;
  pendingRestart: boolean;
};

test('管理文件系统参数可校验、保存、刷新和恢复继承', async ({ page, browser }, testInfo) => {
  const accessPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  const memberPath = process.env.CLOUDDRIVE_INVENTORY_MEMBER_ACCESS;
  test.skip(!accessPath || !memberPath, '设置验证仅使用隔离 QA 服务。');
  const readAccess = async (path: string) =>
    JSON.parse((await readFile(resolve(__dirname, path), 'utf8')).replace(/^\uFEFF/, '')) as {
      username: string;
      password: string;
      url: string;
    };
  const admin = await readAccess(accessPath!);
  const member = await readAccess(memberPath!);
  const origin = new URL(admin.url).origin;
  expect(origin).toBe('http://127.0.0.1:4194');
  expect(new URL(member.url).origin).toBe(origin);
  const login = async (tab: typeof page, account: typeof admin) => {
    await tab.goto(origin + '/login?returnTo=%2Fworkspace');
    await tab.getByLabel('邮箱', { exact: true }).fill(account.username);
    await tab.getByLabel('密码', { exact: true }).fill(account.password);
    await tab.getByRole('button', { name: '登录', exact: true }).click();
    await expect(tab).toHaveURL(/\/workspace$/);
  };
  await login(page, admin);
  await page.getByRole('link', { name: '文件系统', exact: true }).click();
  await expect(page).toHaveURL(/\/system-tools\/filesystem$/);
  const title = page.getByRole('heading', { name: '文件系统', exact: true });
  await expect(title).toBeVisible();
  const text = page.getByLabel('在线文本大小上限（字节）', { exact: true });
  const save = page.getByRole('button', { name: '保存参数', exact: true });
  const dialog = page.getByRole('dialog', { name: '确认保存文件系统参数' });
  const confirm = dialog.getByRole('button', { name: '保存参数', exact: true });
  const endpoint = '/api/console/v1/native/files/settings';
  const readCurrent = () =>
    page.evaluate(async (path) => {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error('Settings read failed with HTTP ' + response.status);
      return (await response.json()) as SettingsResponse;
    }, endpoint);
  const initial = await readCurrent();
  expect(initial.overrides).toEqual({});
  expect(initial.pendingRestart).toBe(false);
  const saveDirect = (revision: number, overrides: SettingsResponse['overrides']) =>
    page.evaluate(
      async ({ endpoint, revision, overrides }) => {
        const { token } = (await (await fetch('/api/console/v1/auth/csrf')).json()) as {
          token: string;
        };
        const response = await fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
          body: JSON.stringify({ revision, overrides }),
        });
        return response.status;
      },
      { endpoint, revision, overrides },
    );
  try {
    await text.fill('0');
    await expect(page.getByText(/请输入 1 至/)).toBeVisible();
    await expect(save).toBeDisabled();
    await text.fill('8192');
    await text.press('Enter');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await expect(save).toBeEnabled();
    await save.click();
    await confirm.click();
    await expect(page.getByRole('status').filter({ hasText: '等待服务重启' })).toBeVisible();
    await page.reload();
    await expect(text).toHaveValue('8192');
    await expect(page.getByText(/已保存 8192/)).toBeVisible();
    const accessibility = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      animations: 'disabled',
      path: testInfo.outputPath('filesystem-desktop.png'),
    });

    await text.fill('4096');
    expect(await saveDirect(initial.revision + 1, { textBytes: 16384 })).toBe(200);
    await save.click();
    await confirm.click();
    await expect(dialog.getByRole('alert')).toContainText('其他管理员已保存新的参数');
    await dialog.getByRole('button', { name: '刷新', exact: true }).click();
    await expect(text).toHaveValue('16384');
    await page.setViewportSize({ width: 320, height: 760 });
    expect(
      await page.locator('main').evaluate((main) => main.scrollWidth <= main.clientWidth),
    ).toBeTruthy();
    await page.screenshot({
      animations: 'disabled',
      path: testInfo.outputPath('filesystem-mobile.png'),
    });
    await page.getByRole('button', { name: '全部恢复继承' }).click();
    await expect(text).toHaveValue('');
    await save.click();
    await confirm.click();
    await expect(page.getByRole('status').filter({ hasText: '当前生效' })).toBeVisible();

    const context = await browser.newContext({ baseURL: origin, locale: 'zh-CN' });
    try {
      const ordinary = await context.newPage();
      await login(ordinary, member);
      await expect(ordinary.getByRole('link', { name: '文件系统', exact: true })).toHaveCount(0);
      await ordinary.goto(origin + '/system-tools/filesystem');
      await expect(
        ordinary.getByRole('alert').filter({ hasText: '当前账户没有文件操作权限' }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  } finally {
    const state = await readCurrent();
    if (Object.keys(state.overrides).length > 0)
      expect(await saveDirect(state.revision, initial.overrides)).toBe(200);
  }
});
