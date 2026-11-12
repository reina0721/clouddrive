import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('节点检查按需读取，关联任务范围可传入并清除', async ({ page }, info) => {
  const accessPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!accessPath, '需要管理员预览访问文件。');
  const account = JSON.parse(
    (await readFile(resolve(__dirname, accessPath!), 'utf8')).replace(/^\uFEFF/, ''),
  ) as { url: string; username: string; password: string };
  const origin = new URL(account.url).origin;
  const nodeId = 'experience-contract-node';
  let checks = 0;
  await page.route('**/native/files/worker-nodes', (route) =>
    route.fulfill({
      json: {
        local: [{ kind: 'zip', enabled: true }],
        nodes: [
          {
            id: nodeId,
            name: '链路验收节点',
            dispatchEnabled: true,
            concurrency: 2,
            reservedBytes: 1048576,
          },
        ],
        canReadTasks: true,
      },
    }),
  );
  await page.route(`**/native/files/worker-nodes/${nodeId}/check`, (route) => {
    checks += 1;
    return route.fulfill({
      json: {
        version: '1.37.0',
        checkedAt: new Date().toISOString(),
        downloadBytesPerSecond: 1024,
        uploadBytesPerSecond: 0,
        active: 1,
        waiting: 0,
        stopped: 0,
      },
    });
  });
  await page.goto(origin + '/login?returnTo=%2Fsystem-tools%2Fnodes');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const worker = page.getByRole('region', { name: '链路验收节点', exact: true });
  await expect(worker).toBeVisible();
  await page.setViewportSize({ width: 320, height: 760 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  expect(checks).toBe(0);
  await worker.getByRole('button', { name: '检查连接', exact: true }).click();
  await expect(worker.getByText('连接正常', { exact: true })).toBeVisible();
  expect(checks).toBe(1);
  await worker.getByRole('link', { name: '查看关联任务', exact: true }).click();
  await expect(page).toHaveURL(origin + '/system-tools/tasks?nodeId=' + nodeId);
  await page.getByRole('button', { name: '筛选与排序', exact: true }).click();
  const filter = page.getByRole('dialog', { name: '筛选与排序', exact: true });
  await expect(filter.getByLabel('节点 ID', { exact: true })).toHaveValue(nodeId);
  await filter.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByText('当前范围内没有符合条件的任务。', { exact: true })).toBeVisible();
  const refreshed = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/admin-tasks/summary') && url.searchParams.get('nodeId') === '';
  });
  await page.getByRole('button', { name: '清除节点范围', exact: true }).click();
  const response = await refreshed;
  expect(response.ok()).toBe(true);
  const summary = (await response.json()) as { total: number };
  expect(summary.total).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: '清除节点范围', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '筛选与排序', exact: true }).click();
  await expect(filter.getByLabel('节点 ID', { exact: true })).toHaveValue('');
  await filter.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('list', { name: '后台任务管理', exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({
    path: info.outputPath('node-task-scope-mobile.png'),
    animations: 'disabled',
  });
});

test('节点管理显示真实 aria2 诊断和已筛选的关联任务', async ({ page }, info) => {
  const accessPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  const nodeId = process.env.CLOUDDRIVE_WORKER_TEST_NODE;
  test.skip(!accessPath || !nodeId, '节点验收使用配置了独立 aria2 的 QA。');
  const account = JSON.parse(
    (await readFile(resolve(__dirname, accessPath!), 'utf8')).replace(/^\uFEFF/, ''),
  ) as { url: string; username: string; password: string };
  const origin = new URL(account.url).origin;
  expect(origin).toBe('http://127.0.0.1:4194');
  await page.goto(origin + '/login?returnTo=%2Fsystem-tools%2Fnodes');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '节点管理', exact: true })).toBeVisible();
  const local = page.getByRole('region', { name: '主机', exact: true });
  await expect(local.getByText('创建 ZIP', { exact: true })).toBeVisible();
  await expect(local.getByText('回收站到期扫描', { exact: true })).toBeVisible();
  const worker = page.getByRole('region', { name: 'QA 下载节点', exact: true });
  await expect(worker.getByText(nodeId!, { exact: true })).toBeVisible();
  await expect(worker.getByText('任务并发上限', { exact: true })).toBeVisible();
  await worker.getByRole('button', { name: '检查连接', exact: true }).click();
  await expect(worker.getByText('连接正常', { exact: true })).toBeVisible();
  await expect(worker.getByText('1.37.0', { exact: true })).toBeVisible();
  await expect(worker.getByText('统计包含此 aria2 实例的全部任务。')).toBeVisible();
  await page.screenshot({
    path: info.outputPath('worker-nodes-desktop.png'),
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 320, height: 760 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await worker.getByRole('link', { name: '查看关联任务', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath('worker-nodes-mobile.png'),
    animations: 'disabled',
  });
  await worker.getByRole('link', { name: '查看关联任务', exact: true }).click();
  await expect(page).toHaveURL(origin + '/system-tools/tasks?nodeId=' + nodeId);
  await page.getByRole('button', { name: '筛选与排序', exact: true }).click();
  const filter = page.getByRole('dialog', { name: '筛选与排序', exact: true });
  await expect(filter.getByLabel('节点 ID', { exact: true })).toHaveValue(nodeId!);
  await filter.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '清除节点范围', exact: true }).click();
  await expect(page.getByRole('button', { name: '清除节点范围', exact: true })).toHaveCount(0);
});
