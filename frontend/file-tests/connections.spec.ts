import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

test('连接管理、一次性凭据、真实同源WebDAV与窄屏布局', async ({ page, context }) => {
  test.setTimeout(180_000);
  const access = JSON.parse(
    (
      await readFile(
        resolve(
          __dirname,
          process.env.CLOUDDRIVE_FILE_TEST_ACCESS ?? '../../.data/preview-access.json',
        ),
        'utf8',
      )
    ).replace(/^\uFEFF/, ''),
  ) as { username: string; password: string };
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  const rootName = `连接目录-${Date.now()}`;
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '创建文件夹', exact: true }).click();
  await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill(rootName);
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('button', { name: rootName, exact: true })).toBeVisible();
  await page.getByRole('link', { name: '连接与挂载', exact: true }).first().click();
  await expect(page).toHaveURL(/\/home\/connections$/);
  const name = `挂载-${Date.now()}`;
  await page.getByRole('button', { name: '创建连接', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('备注名称', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: rootName + '/', exact: true }).click();
  await expect(dialog).toContainText('当前选择: /' + rootName);
  await expect(dialog.getByRole('button', { name: '创建', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('保存连接凭据');
  const values = await dialog.locator('code').allTextContents();
  const endpoint = values[0]!,
    username = values[1]!,
    password = values[2]!;
  expect(endpoint).not.toContain(password);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await dialog.getByRole('button', { name: '复制服务器地址', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('已复制');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(endpoint);
  await dialog.getByRole('button', { name: '复制用户名', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(username);
  await dialog.getByRole('button', { name: '复制独立密码', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(password);
  await dialog.getByRole('button', { name: '复制服务器地址', exact: true }).click();
  // 使用管理响应给出的真实API端点，避开Next开发代理的整包克隆限制。
  const headers = {
    Authorization: 'Basic ' + Buffer.from(username + ':' + password).toString('base64'),
  };
  const directory = 'browser-' + Date.now();
  expect(
    (await page.request.fetch(endpoint + directory, { method: 'MKCOL', headers })).status(),
  ).toBe(201);
  const content = Buffer.alloc(33 * 1024 * 1024, 79);
  const upload = await page.request.put(endpoint + directory + '/large.bin', {
    headers,
    data: content,
  });
  expect(upload.status()).toBe(201);
  const download = await page.request.get(endpoint + directory + '/large.bin', { headers });
  expect(
    createHash('sha256')
      .update(await download.body())
      .digest('hex'),
  ).toBe(createHash('sha256').update(content).digest('hex'));
  expect(
    (
      await page.request.fetch(endpoint + directory + '/', {
        method: 'PROPFIND',
        headers: { ...headers, Depth: '1' },
      })
    ).status(),
  ).toBe(207);
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    await page.evaluate(
      (secret) => Object.values(localStorage).some((value) => String(value).includes(secret)),
      password,
    ),
  ).toBe(false);
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await row.getByRole('button', { name: '重命名', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('备注名称', { exact: true }).fill(name + '-改名');
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  const renamed = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: name + '-改名', exact: true }) });
  await expect(renamed).toBeVisible();
  await renamed.getByRole('button', { name: '修改权限', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: '只读', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(dialog.getByRole('checkbox', { name: '只读', exact: true })).toBeChecked();
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  await expect(renamed).toContainText('只读');
  expect(
    (await page.request.put(endpoint + 'readonly.txt', { headers, data: 'blocked' })).status(),
  ).toBe(403);
  await renamed.getByRole('button', { name: '停用', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(renamed).toContainText('已停用');
  expect((await page.request.get(endpoint + directory + '/large.bin', { headers })).status()).toBe(
    401,
  );
  await renamed.getByRole('button', { name: '启用', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(renamed).toContainText('启用中');
  await page.screenshot({ path: 'test-results/files/connections-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/files/connections-mobile.png', fullPage: true });
  await renamed.getByRole('button', { name: '轮换密码', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('保存连接凭据');
  const newPassword = await dialog.locator('code').nth(2).innerText();
  expect(newPassword).not.toBe(password);
  expect((await page.request.get(endpoint + directory + '/large.bin', { headers })).status()).toBe(
    401,
  );
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await renamed.getByRole('button', { name: '撤销', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(renamed).toContainText('已撤销');
  await page.reload();
  await expect(renamed).toContainText('已撤销');
  expect(errors).toEqual([]);
});
