import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const accessFile = process.env.CLOUDDRIVE_FILE_TEST_ACCESS ?? '';
test.skip(!process.env.CLOUDDRIVE_TRASH_FIXTURE, '清空验收需要专用一次性测试账号。');

async function request<T>(page: Page, path: string, body?: unknown): Promise<T> {
  return page.evaluate(
    async ({ path, body }) => {
      const csrf = ((await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string })
        .token;
      const response = await fetch('/api/console/v1/native/files' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new Error('夹具请求失败，状态 ' + response.status);
      return (await response.json()) as T;
    },
    { path, body },
  );
}

test('F541–F560：单项和目录批量删除、旧确认冲突及跨页清空', async ({ page }, info) => {
  const access = JSON.parse(
    (await readFile(resolve(__dirname, accessFile), 'utf8')).replace(/^\uFEFF/, ''),
  ) as {
    purpose?: string;
    username: string;
    password: string;
  };
  if (access.purpose !== 'trash-purge-fixture') throw new Error('清空只能在一次性测试账号执行');
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  expect(
    (await request<{ entryCount: number }>(page, '/trash/purge-preview', { scope: 'all', ids: [] }))
      .entryCount,
  ).toBe(0);

  const folder = (name: string, parentId = '') =>
    request<{ id: string }>(page, '/folders', { name, parentId });
  const text = (name: string, parentId = '') =>
    request<{ id: string }>(page, '/text', {
      name,
      parentId,
      text: 'test-bytes',
      key: crypto.randomUUID(),
    });
  const trash = (id: string) => request(page, '/' + id + '/trash', {});
  const individual = await text('待永久删除.txt');
  const parent = await folder('待永久删除目录');
  const child = await text('已单独回收.txt', parent.id);
  await text('仍在原目录的子项.txt', parent.id);
  const survivor = await text('保留在我的文件.txt');
  await trash(individual.id);
  await trash(child.id);
  await trash(parent.id);
  await page.getByRole('link', { name: '回收站', exact: true }).click();
  const clear = page.getByRole('button', { name: '清空回收站', exact: true });
  await expect(clear).toBeVisible();
  await expect(page.getByRole('button', { name: '新建', exact: true })).toHaveCount(0);
  const purge = page.getByRole('dialog', { name: '永久删除', exact: true });
  async function openFilePurge() {
    await page.getByRole('button', { name: '待永久删除.txt 的操作', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: '恢复', exact: true })).toBeVisible();
    await page.getByRole('menuitem', { name: '永久删除', exact: true }).click();
    await expect(purge).toContainText('将删除 1 项');
    await expect(purge).toContainText('10 B');
  }
  await openFilePurge();
  await purge.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('button', { name: '待永久删除.txt', exact: true })).toBeVisible();
  await openFilePurge();
  await purge.getByRole('button', { name: '永久删除', exact: true }).click();
  await expect(page.getByRole('button', { name: '待永久删除.txt', exact: true })).toHaveCount(0);

  // 单独回收的后代和父目录同时选中时，只释放一次后代配额。
  for (const name of ['待永久删除目录', '已单独回收.txt']) {
    const checkbox = page.getByRole('checkbox', { name: '选择 ' + name, exact: true });
    if (!(await checkbox.isChecked())) await checkbox.press('Space');
    await expect(checkbox).toBeChecked();
  }
  await page.getByRole('button', { name: '永久删除', exact: true }).click();
  await expect(purge).toContainText('将删除 3 项');
  await expect(purge).toContainText('20 B');
  await purge.getByRole('button', { name: '永久删除', exact: true }).click();
  await expect(page.getByRole('button', { name: '待永久删除目录', exact: true })).toHaveCount(0);

  for (let index = 0; index < 52; index++) {
    const entry = await folder('跨页验收-' + String(index).padStart(2, '0'));
    await trash(entry.id);
  }
  await page.goto('/home?trash=true&search=' + encodeURIComponent('跨页验收-00'));
  await expect(page.getByRole('button', { name: '跨页验收-00', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '跨页验收-51', exact: true })).toHaveCount(0);
  await clear.click();
  const confirmAll = page.getByRole('dialog', { name: '清空回收站', exact: true });
  await expect(confirmAll).toContainText('将删除 52 项');
  await expect(confirmAll).toContainText('其他页和筛选隐藏的项目');
  await page.screenshot({
    path: info.outputPath('trash-purge-desktop.png'),
    animations: 'disabled',
  });
  const late = await folder('确认后新增');
  await trash(late.id);
  const confirm = confirmAll.getByRole('button', { name: '清空回收站', exact: true });
  await confirm.click();
  await expect(confirmAll.getByRole('alert')).toContainText('回收站内容已经变化');
  await expect(confirm).toBeDisabled();
  await confirmAll.getByRole('button', { name: '重新核对', exact: true }).click();
  await expect(confirmAll).toContainText('将删除 53 项');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: info.outputPath('trash-purge-mobile.png'),
    animations: 'disabled',
  });
  await confirm.click();
  await expect(confirmAll).toHaveCount(0);
  await page.goto('/home?trash=true');
  await expect(page.getByText('回收站为空', { exact: true })).toBeVisible();
  await clear.click();
  await expect(confirmAll.getByText('回收站为空', { exact: true })).toBeVisible();
  await expect(confirm).toBeDisabled();
  await confirmAll.getByRole('button', { name: '取消', exact: true }).click();
  expect((await request<{ entry: { id: string } }>(page, '/' + survivor.id)).entry.id).toBe(
    survivor.id,
  );
});
