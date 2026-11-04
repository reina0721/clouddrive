import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function newAction(page: Page, label: string) {
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
  await expect(page.getByRole('dialog', { name: '新建', exact: true })).toHaveCount(0);
}
async function fileAction(page: Page, name: string, label: string) {
  await page.getByRole('button', { name: name + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
  await expect(page.getByRole('dialog', { name: name + ' 的操作', exact: true })).toHaveCount(0);
}

const accessPath = resolve(__dirname, '../../.data/preview-access.json');
test.beforeEach(async ({ page }) => {
  const access = JSON.parse((await readFile(accessPath, 'utf8')).replace(/^\uFEFF/, '')) as {
    username: string;
    password: string;
  };
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('button', { name: '新建', exact: true })).toBeEnabled();
});

test('多选部分失败逐项呈现，键盘选择和已成功移动的结果保持一致', async ({ page }) => {
  const suffix = Date.now().toString(36);
  const first = `批量目标-${suffix}`;
  const second = `批量子项-${suffix}`;
  for (const name of [first, second]) {
    await newAction(page, '创建文件夹');
    await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill(name);
    await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  const firstCheckbox = page.getByRole('checkbox', { name: `选择 ${first}`, exact: true });
  await firstCheckbox.press('Space');
  await expect(firstCheckbox).toBeChecked();
  await page.getByRole('checkbox', { name: `选择 ${second}`, exact: true }).press('Space');
  await page.getByRole('button', { name: '移动', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: first, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('1 项未完成');
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: first, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: second, exact: true })).toHaveCount(0);
  await fileAction(page, first, '移入回收站');
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('button', { name: first, exact: true })).toHaveCount(0);
});

test('真实文件闭环：目录、队列、预览、下载、移动、多选、回收恢复与视图持久化', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  const suffix = Date.now().toString(36);
  const folder = `验收目录-${suffix}`;
  const textName = `文档-${suffix}.txt`;
  const renamed = `已重命名-${suffix}.txt`;
  const imageName = `图片-${suffix}.png`;
  const content = Buffer.from('文件验收\n<script>window.filePreviewExecuted = true</script>\n');
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
    'base64',
  );

  await newAction(page, '创建文件夹');
  await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill(folder);
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await page.getByRole('button', { name: folder, exact: true }).click();
  await expect(page).toHaveURL(/parent=/);
  const choose = page.waitForEvent('filechooser');
  await newAction(page, '上传文件');
  await (
    await choose
  ).setFiles([
    { name: textName, mimeType: 'text/plain', buffer: content },
    { name: imageName, mimeType: 'image/png', buffer: image },
  ]);
  await expect(page.getByText('上传完成', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: textName, exact: true }).click();
  await expect(page.getByRole('dialog').locator('pre')).toContainText('<script>');
  expect(await page.evaluate(() => 'filePreviewExecuted' in window)).toBe(false);
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await fileAction(page, textName, '属性');
  await expect(page.getByRole('dialog')).toContainText(`${content.length} B`);
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await fileAction(page, textName, '下载');
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(textName);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  expect(await readFile(downloadPath)).toEqual(content);
  await fileAction(page, textName, '重命名');
  await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill(renamed);
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('button', { name: renamed, exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: `选择 ${renamed}`, exact: true }).press('Space');
  await page.getByRole('button', { name: '移动', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('button', { name: renamed, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '图片', exact: true }).click();
  await expect(page.getByRole('button', { name: imageName, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '我的文件', exact: true }).first().click();
  await page.getByRole('searchbox', { name: '搜索文件' }).fill(renamed);
  await page.getByRole('button', { name: '搜索文件', exact: true }).click();
  await expect(page.getByRole('button', { name: renamed, exact: true })).toBeVisible();
  await page.goto('/home');
  await page.getByRole('button', { name: '列表', exact: true }).click();
  await page.getByRole('button', { name: /切换排序方向/ }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /↓ 切换排序方向/ })).toBeVisible();
  await fileAction(page, folder, '移入回收站');
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('button', { name: folder, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '回收站', exact: true }).click();
  await fileAction(page, folder, '恢复');
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await page.getByRole('button', { name: '我的文件', exact: true }).first().click();
  await expect(page.getByRole('button', { name: folder, exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: `选择 ${folder}`, exact: true }).press('Space');
  await page.getByRole('checkbox', { name: `选择 ${renamed}`, exact: true }).press('Space');
  await page.getByRole('button', { name: '移入回收站', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('button', { name: folder, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: renamed, exact: true })).toHaveCount(0);
  expect(runtimeErrors).toEqual([]);
});

test('桌面和窄屏视觉、无横向溢出、2 MiB 实际上传与未登录隔离', async ({ page, browser }) => {
  const name = `large-${Date.now()}.txt`;
  const choose = page.waitForEvent('filechooser');
  await newAction(page, '上传文件');
  await (
    await choose
  ).setFiles({ name, mimeType: 'text/plain', buffer: Buffer.alloc(2 << 20, 'a') });
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  const listing = await page.evaluate(async () => {
    const response = await fetch('/api/console/v1/native/files');
    const body: unknown = await response.json();
    return { status: response.status, body };
  });
  expect(listing.status).toBe(200);
  const body = listing.body as { items: { id: string; name: string; sizeBytes: number }[] };
  const item = body.items.find((entry) => entry.name === name);
  expect(item?.sizeBytes).toBe(2 << 20);
  const anonymous = await browser.newContext();
  const response = await anonymous.request.get(
    new URL(`/api/console/v1/native/files/${item!.id}/content`, page.url()).href,
  );
  expect(response.status()).toBe(401);
  await anonymous.close();
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({ path: 'test-results/files-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/files-mobile.png', fullPage: true });
});

test('拖拽上传使用同一队列，等待项可以取消并保持未提交状态', async ({ page }) => {
  const suffix = Date.now().toString(36);
  const names = [
    `drop-one-${suffix}.txt`,
    `drop-two-${suffix}.txt`,
    `drop-canceled-${suffix}.txt`,
  ] as const;
  let release = () => {};
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  await page.route('**/native/files/upload?**', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    const transfer = await page.evaluateHandle((names) => {
      const value = new DataTransfer();
      for (const name of names)
        value.items.add(new File(['drag and drop content'], name, { type: 'text/plain' }));
      return value;
    }, names);
    await page.locator('main').dispatchEvent('drop', { dataTransfer: transfer });
    const canceled = page.getByRole('listitem').filter({ hasText: names[2] });
    await expect(canceled).toContainText('等待上传');
    await canceled.getByRole('button', { name: '取消', exact: true }).click();
    await expect(canceled).toContainText('已取消');
    release();
    await expect(page.getByText('上传完成', { exact: true })).toHaveCount(2);
    await expect(page.getByRole('button', { name: names[2], exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: names[0], exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: names[2], exact: true })).toHaveCount(0);
  } finally {
    release();
    await page.unroute('**/native/files/upload?**');
  }
});
