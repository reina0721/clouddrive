import { randomUUID } from 'node:crypto';
import { access, readFile, realpath } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from '@playwright/test';

test('管理员能确认回收验收对象，保护期内仍显示候选', async ({ page }, testInfo) => {
  const accessPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  const qaStatePath = process.env.CLOUDDRIVE_BLOB_RECLAMATION_QA_STATE;
  test.skip(!accessPath || !qaStatePath, '回收验收仅在隔离服务处理本测试生成的对象。');
  const parse = async (path: string): Promise<unknown> =>
    JSON.parse((await readFile(resolve(__dirname, path), 'utf8')).replace(/^\uFEFF/, ''));
  const account = (await parse(accessPath!)) as { username: string; password: string; url: string };
  const state = (await parse(qaStatePath!)) as { directory: string };
  expect(new URL(account.url).origin).toBe('http://127.0.0.1:4194');
  const root = await realpath(resolve(__dirname, '../../.data/135-validation-suites'));
  const directory = await realpath(state.directory);
  expect(directory.toLowerCase().startsWith((root + sep).toLowerCase())).toBe(true);
  await page.goto('http://127.0.0.1:4194/login?returnTo=%2Fsystem-tools%2Fblobs');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/system-tools\/blobs$/);
  const id = await page.evaluate(async (fixture) => {
    const { token } = (await (await fetch('/api/console/v1/auth/csrf')).json()) as {
      token: string;
    };
    const call = async (path: string, body?: object): Promise<unknown> => {
      const response = await fetch('/api/console/v1/native/files' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) throw new Error('Reclamation fixture failed with HTTP ' + response.status);
      return response.json();
    };
    const created = (await call('/text', {
      parentId: '',
      name: 'reclamation-' + fixture + '.txt',
      key: fixture,
      text: 'isolated',
    })) as { id: string };
    await call('/' + created.id + '/trash');
    const selection = { scope: 'selection', ids: [created.id] };
    const { snapshot } = (await call('/trash/purge-preview', selection)) as { snapshot: string };
    await call('/trash/purge', { ...selection, snapshot });
    return created.id;
  }, randomUUID());
  const object = join(directory, 'storage', 'files', id);
  await access(object);
  await page.getByRole('button', { name: '待回收', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: id });
  await expect(page.getByText('自动回收已关闭')).toBeVisible();
  await expect(row).toContainText('保护期内');
  await expect(row.getByRole('button')).toHaveCount(0);
  await page.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('blob-reclamation-desktop.png'),
  });

  // 仅快进本次上传生成的候选，保留实际存储和回收请求的生产路径。
  const database = new DatabaseSync(join(directory, 'app.db'));
  try {
    const result = database
      .prepare('UPDATE files_blob_candidates SET ready_at = detached_at WHERE object_key = ?')
      .run('files/' + id);
    expect(result.changes).toBe(1);
  } finally {
    database.close();
  }
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(row.getByRole('button', { name: '永久清理' })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 760 });
  await row.getByRole('button', { name: '永久清理' }).click();
  const dialog = page.getByRole('dialog', { name: '永久清理' });
  await expect(dialog).toContainText(id);
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await access(object);
  await row.getByRole('button', { name: '永久清理' }).click();
  await page.screenshot({
    animations: 'disabled',
    path: testInfo.outputPath('blob-reclamation-confirm.png'),
  });
  await dialog.getByRole('button', { name: '永久清理', exact: true }).click();
  await expect(page.getByText('已清理 Blob', { exact: true })).toBeVisible();
  await expect(row).toHaveCount(0);
  await expect(access(object)).rejects.toMatchObject({ code: 'ENOENT' });
  await page.getByRole('button', { name: '已引用', exact: true }).click();
  await expect(page.getByRole('heading', { name: '文件 Blob', exact: true })).toBeVisible();
});
