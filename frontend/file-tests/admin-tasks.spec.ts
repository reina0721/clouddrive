import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

type Access = { url: string; username: string; password: string };
type Job = { id: string; state: string; resultEntryId: string };
type MaintenanceList = { items: { id: string; ownerId: string; durationMs: number }[] };
type TaskSummary = {
  total: number;
  active: number;
  completed: number;
  failed: number;
  canceled: number;
  expired: number;
  cleanable: number;
  asOf: string;
};

async function login(page: Page, account: Access, path: string) {
  const origin = new URL(account.url).origin;
  await page.goto(origin + '/login?returnTo=' + encodeURIComponent(path));
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(origin + path);
}

async function fileRequest<T>(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      const { token } = (await (
        await fetch('/api/console/v1/auth/csrf', { cache: 'no-store' })
      ).json()) as { token: string };
      const response = await fetch(
        '/api/console/v1/native/files' + path,
        body === undefined
          ? { cache: 'no-store' }
          : {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
              body: JSON.stringify(body),
            },
      );
      if (!response.ok) throw new Error('Task fixture failed with HTTP ' + response.status);
      return (await response.json()) as T;
    },
    { path, body },
  );
}

test('任务摘要不被状态筛选污染，移动端任务条目没有横向溢出', async ({ page }) => {
  const accessPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!accessPath, '任务只读验收需要管理员访问文件。');
  const account = JSON.parse(
    (await readFile(resolve(__dirname, accessPath!), 'utf8')).replace(/^\uFEFF/, ''),
  ) as Access;
  await login(page, account, '/system-tools/tasks');
  const summary = await fileRequest<TaskSummary>(page, '/admin-tasks/summary');
  expect(summary.total).toBe(
    summary.active + summary.completed + summary.failed + summary.canceled + summary.expired,
  );
  expect(summary.cleanable).toBeLessThanOrEqual(summary.total);
  expect(Date.parse(summary.asOf)).not.toBeNaN();
  const snapshot = page.getByLabel('运行概况', { exact: true });
  await expect(snapshot.getByText(String(summary.total), { exact: true }).first()).toBeVisible();
  await expect(snapshot.getByText(String(summary.failed), { exact: true }).first()).toBeVisible();
  test.skip(summary.failed === 0, '当前数据没有失败任务，无法验证快捷筛选。');
  await page.getByRole('button', { name: '查看失败', exact: true }).click();
  await expect(page.getByRole('status')).toContainText(`共 ${summary.failed} 项`);
  await expect(snapshot.getByText(String(summary.total), { exact: true }).first()).toBeVisible();
  const list = page.getByRole('list', { name: '后台任务管理', exact: true });
  await expect(list.getByRole('listitem')).toHaveCount(Math.min(summary.failed, 20));
  await list.getByRole('listitem').first().getByRole('button').click();
  const detail = page.getByRole('dialog', { name: '任务详情', exact: true });
  await expect(detail.getByText('故障代码', { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: '关闭', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 760 });
  await expect
    .poll(() =>
      page.evaluate(() => ({
        document: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        rows: [...document.querySelectorAll('main li')].every(
          (item) => item.scrollWidth <= item.clientWidth,
        ),
      })),
    )
    .toEqual({ document: true, rows: true });
});

test('管理员过滤并清理成员的终态归档任务，保留发布文件', async ({ page, browser }, info) => {
  const adminPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  const memberPath = process.env.CLOUDDRIVE_INVENTORY_MEMBER_ACCESS;
  test.skip(!adminPath || !memberPath, '清理验收仅使用隔离 QA。');
  const readAccess = async (path: string) =>
    JSON.parse((await readFile(resolve(__dirname, path), 'utf8')).replace(/^\uFEFF/, '')) as Access;
  const [admin, member] = await Promise.all([readAccess(adminPath!), readAccess(memberPath!)]);
  const origin = new URL(admin.url).origin;
  expect(origin).toBe('http://127.0.0.1:4194');
  expect(new URL(member.url).origin).toBe(origin);
  const memberContext = await browser.newContext({ locale: 'zh-CN' });
  try {
    const owner = await memberContext.newPage();
    await login(owner, member, '/home');
    const suffix = randomUUID().slice(0, 8);
    const folder = await fileRequest<{ id: string }>(owner, '/folders', {
      parentId: '',
      name: `任务验收-${suffix}`,
    });
    const source = await fileRequest<{ id: string }>(owner, '/text', {
      parentId: folder.id,
      name: 'source.txt',
      key: randomUUID(),
      text: 'task fixture',
    });
    const zip = `任务结果-${suffix}.zip`;
    const submitted = await fileRequest<Job>(owner, '/archive-tasks/zip', {
      clientKey: randomUUID(),
      sourceIds: [source.id],
      parentId: folder.id,
      name: zip,
    });
    const personalTask = '/archive-tasks/' + submitted.id;
    await expect
      .poll(async () => (await fileRequest<Job>(owner, personalTask)).state, { timeout: 25000 })
      .toBe('completed');
    const result = await fileRequest<Job>(owner, personalTask);
    expect(result.resultEntryId).not.toBe('');

    await login(page, admin, '/system-tools/tasks');
    await page.getByRole('button', { name: '清理已结束记录', exact: true }).first().click();
    const criteria = page.getByRole('dialog', { name: '清理已结束记录', exact: true });
    for (const [name, value] of [
      [/^(年|year),/i, '2000'],
      [/^(月|month),/i, '01'],
      [/^(日|day),/i, '01'],
    ] as const) {
      const segment = criteria.getByRole('spinbutton', { name });
      await segment.press('ControlOrMeta+a');
      await segment.pressSequentially(value);
      await segment.press('Tab');
    }
    await criteria.getByRole('button', { name: '预览清理范围', exact: true }).click();
    const emptyPreview = page.getByRole('dialog', { name: '清理已结束记录', exact: true });
    await expect(
      emptyPreview.getByText('本批可清理 0 条，共匹配 0 条。', { exact: true }),
    ).toBeVisible();
    await expect(
      emptyPreview.getByRole('button', { name: '清理已结束记录', exact: true }),
    ).toBeDisabled();
    await emptyPreview.getByRole('button', { name: '取消', exact: true }).click();
    await page.getByRole('button', { name: '筛选与排序', exact: true }).click();
    const filters = page.getByRole('dialog', { name: '筛选与排序', exact: true });
    await filters.getByLabel('任务 ID', { exact: true }).fill(submitted.id);
    await filters.getByRole('button', { name: '应用', exact: true }).click();
    const list = page.getByRole('list', { name: '后台任务管理', exact: true });
    const row = list.getByRole('listitem').filter({ hasText: submitted.id.slice(0, 8) });
    await expect(row).toHaveCount(1);
    await row.getByRole('button').click();
    const detail = page.getByRole('dialog', { name: '任务详情', exact: true });
    await expect(detail.getByText(submitted.id, { exact: true })).toBeVisible();
    await detail.getByRole('button', { name: '关闭', exact: true }).click();
    await page.screenshot({
      path: info.outputPath('admin-tasks-desktop.png'),
      animations: 'disabled',
    });

    await page.setViewportSize({ width: 320, height: 760 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await row.getByRole('checkbox').press('Space', { timeout: 10000 });
    await page.getByRole('button', { name: '清理所选记录', exact: true }).click();
    const confirm = page.getByRole('dialog', { name: '清理已结束记录', exact: true });
    await expect(confirm.getByText(submitted.id, { exact: false })).toBeVisible();
    await page.screenshot({
      path: info.outputPath('admin-tasks-mobile.png'),
      animations: 'disabled',
    });
    await confirm.getByRole('button', { name: '清理已结束记录', exact: true }).click();
    await expect(page.getByText('已清理 1 条，未清理 0 条。', { exact: true })).toBeVisible();
    await expect(page.getByText('当前范围内没有符合条件的任务。', { exact: true })).toBeVisible();
    await owner.goto(origin + '/home?parent=' + folder.id);
    await expect(owner.getByRole('button', { name: zip, exact: true })).toBeVisible();
  } finally {
    await memberContext.close();
  }
});

test('管理员可以筛选调度器生成的系统维护记录', async ({ page }, info) => {
  test.setTimeout(100000);
  const accessPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!accessPath, '维护验收使用已启用调度器的隔离 QA。');
  const account = JSON.parse(
    (await readFile(resolve(__dirname, accessPath!), 'utf8')).replace(/^\uFEFF/, ''),
  ) as Access;
  expect(new URL(account.url).origin).toBe('http://127.0.0.1:4194');
  await login(page, account, '/system-tools/tasks');
  let run: MaintenanceList['items'][number] | undefined;
  await expect
    .poll(
      async () => {
        const result = await fileRequest<MaintenanceList>(
          page,
          '/admin-tasks?origin=system&kind=trash-expiry&status=completed',
        );
        [run] = result.items;
        return run?.id;
      },
      { timeout: 75000, intervals: [500, 2000, 5000] },
    )
    .toBeTruthy();
  expect(run!.ownerId).toBe('');
  expect(run!.durationMs).toBeGreaterThanOrEqual(0);
  const summary = await fileRequest<TaskSummary>(page, '/admin-tasks/summary?origin=system');
  expect(summary.total).toBeGreaterThanOrEqual(1);
  expect(summary.cleanable).toBeLessThanOrEqual(summary.total);
  await page.getByRole('button', { name: '筛选与排序', exact: true }).click();
  const filters = page.getByRole('dialog', { name: '筛选与排序', exact: true });
  await filters.getByLabel('任务 ID', { exact: true }).fill(run!.id);
  await filters.getByRole('button', { name: '来源', exact: false }).click();
  await page.getByRole('option', { name: '系统维护', exact: true }).click();
  await filters.getByRole('button', { name: '应用', exact: true }).click();
  const list = page.getByRole('list', { name: '后台任务管理', exact: true });
  const row = list.getByRole('listitem').filter({ hasText: run!.id.slice(0, 8) });
  await expect(row.getByText('系统', { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('maintenance-desktop.png'),
    animations: 'disabled',
  });
  await row.getByRole('button', { name: '回收站到期扫描', exact: true }).click();
  const detail = page.getByRole('dialog', { name: '任务详情', exact: true });
  for (const label of ['开始时间', '结束时间', '运行耗时（毫秒）']) {
    await expect(detail.getByText(label, { exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 320, height: 760 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({
    path: info.outputPath('maintenance-mobile.png'),
    animations: 'disabled',
  });
  await detail.getByRole('button', { name: '关闭', exact: true }).click();
  await row.getByRole('checkbox').press('Space');
  await page.getByRole('button', { name: '清理所选记录', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: '清理已结束记录', exact: true });
  await expect(confirmation.getByText(run!.id, { exact: false })).toBeVisible();
  await confirmation.getByRole('button', { name: '清理已结束记录', exact: true }).click();
  await expect(page.getByText('已清理 1 条，未清理 0 条。', { exact: true })).toBeVisible();
  await expect(page.getByText('当前范围内没有符合条件的任务。', { exact: true })).toBeVisible();
});
