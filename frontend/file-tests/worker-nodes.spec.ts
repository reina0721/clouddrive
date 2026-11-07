import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

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
  await page.getByRole('button', { name: '过滤', exact: true }).click();
  const filter = page.getByRole('dialog', { name: '过滤', exact: true });
  await expect(filter.getByLabel('节点 ID', { exact: true })).toHaveValue(nodeId!);
  await filter.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '清除节点筛选', exact: true }).click();
  await expect(page.getByRole('button', { name: '清除节点筛选', exact: true })).toHaveCount(0);
});
