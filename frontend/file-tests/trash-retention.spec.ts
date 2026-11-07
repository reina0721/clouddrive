import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('回收站期限只作用于未来回收，并可在桌面和窄屏管理', async ({ page }, testInfo) => {
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
  ) as { purpose?: string; username: string; password: string; url: string };
  test.skip(access.purpose !== 'trash-retention-fixture', '期限验证使用独立验收账号。');
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  const api = async (path: string, method = 'GET', body?: object, guarded = true) =>
    page.evaluate(
      async ({ path, method, body, guarded }) => {
        const csrf = await fetch('/api/console/v1/auth/csrf', { cache: 'no-store' });
        if (!csrf.ok) throw new Error('CSRF request failed with HTTP ' + csrf.status);
        const { token } = (await csrf.json()) as { token: string };
        const response = await fetch('/api/console/v1/native/files' + path, {
          method,
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            ...(guarded ? { 'X-CSRF-Token': token } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return { status: response.status, value: (await response.json()) as unknown };
      },
      { path, method, body, guarded },
    );
  const policy = async () => {
    const response = await api('/trash/retention');
    expect(response.status).toBe(200);
    return response.value as { days: number; revision: number };
  };
  const put = async (days: number, revision: number) =>
    api('/trash/retention', 'PUT', { days, revision });
  const initial = await policy();
  expect(
    (await api('/trash/retention', 'PUT', { days: 1, revision: initial.revision }, false)).status,
  ).toBe(403);
  if (initial.days !== 0) expect((await put(0, initial.revision)).status).toBe(200);
  const fixture = async (label: string) => {
    const name = label + '-' + randomUUID().slice(0, 8) + '.txt';
    const file = await api('/text', 'POST', { parentId: '', name, text: label, key: randomUUID() });
    expect(file.status).toBe(200);
    const { id } = file.value as { id: string };
    const response = await api('/' + id + '/trash', 'POST');
    expect(response.status).toBe(200);
    return { id, name, result: response.value as { trashExpiresAt?: string } };
  };
  const old = await fixture('手动清理');
  expect(old.result.trashExpiresAt).toBeUndefined();

  const trigger = page.getByRole('button', { name: '保留规则', exact: true });
  await expect(trigger).toHaveCount(0);
  await page.goto('/home?trash=true');
  await expect(page.getByRole('button', { name: '清空回收站', exact: true })).toBeVisible();
  const dialog = page.getByRole('dialog', { name: '保留规则', exact: true });
  const input = dialog.getByLabel('保留天数', { exact: true });
  const save = dialog.getByRole('button', { name: '保存', exact: true });
  await trigger.click();
  await expect(input).toHaveValue('0');
  await expect(dialog).toContainText('以后移入回收站');
  await input.fill('366');
  await save.click();
  await expect(dialog).toContainText('请输入有效的保留天数');
  await expect(input).toHaveValue('366');
  const version = (await policy()).revision;
  expect((await put(2, version)).status).toBe(200);
  await input.fill('7');
  await save.click();
  await expect(save).toBeDisabled();
  await dialog.getByRole('button', { name: '读取最新设置', exact: true }).click();
  await expect(input).toHaveValue('2');
  await input.fill('7');
  await save.click();
  await expect(dialog).toHaveCount(0);
  expect((await policy()).days).toBe(7);

  const future = await fixture('按期清理');
  expect(future.result.trashExpiresAt).toEqual(expect.any(String));
  await page.reload();
  const card = (name: string) =>
    page
      .locator('[data-file-item]')
      .filter({ has: page.getByRole('button', { name, exact: true }) });
  await expect(card(future.name)).toContainText('到期');
  await expect(card(old.name)).toBeVisible();
  await expect(card(old.name)).not.toContainText('到期');
  await page.screenshot({ path: testInfo.outputPath('trash-retention-desktop.png') });
  const chooseView = async (name: string) => {
    await page.getByRole('button', { name: '视图', exact: true }).click();
    await page.getByRole('menuitem', { name, exact: true }).click();
  };
  await chooseView('列表');
  await expect(card(future.name)).toHaveAttribute('role', 'row');
  await expect(card(future.name)).toContainText('到期');
  await chooseView('网格');
  await expect(card(future.name)).not.toHaveAttribute('role', 'row');
  await page.setViewportSize({ width: 320, height: 740 });
  await trigger.click();
  await expect(input).toHaveValue('7');
  await expect(input).toHaveAttribute('inputmode', 'numeric');
  const sizes = await dialog.evaluate((element) => [element.scrollWidth, element.clientWidth]);
  expect(sizes[0]).toBeLessThanOrEqual(sizes[1]!);
  await page.screenshot({ path: testInfo.outputPath('trash-retention-mobile.png') });
  await input.fill('0');
  await save.click();
  await expect(dialog).toHaveCount(0);
  expect((await policy()).days).toBe(0);
  await expect(card(future.name)).toContainText('到期');
});
