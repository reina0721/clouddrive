import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';

test.use({ actionTimeout: 15_000 });
test.skip(
  process.env.CLOUDDRIVE_FILE_TEST_OFFLINE_SOURCE_ALLOWED !== '1',
  '需要隔离测试库与仅用于夹具的127.0.0.1/32来源授权；不修改普通预览的公网来源策略。',
);
let source: Server;
let origin = '';
const contents = Buffer.from('real server download bytes\n');
const interrupted = new Set<string>();
const slowContents = Buffer.alloc(4 * 1024 * 1024, 90);

test.beforeAll(async () => {
  source = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://fixture.local');
    response.setHeader('Content-Type', 'text/plain');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${url.searchParams.get('name') ?? 'download.txt'}"`,
    );
    if (url.pathname === '/flaky' && !interrupted.has(url.searchParams.get('name') ?? '')) {
      interrupted.add(url.searchParams.get('name') ?? '');
      response.setHeader('Content-Length', String(contents.length));
      const socket = response.socket;
      response.end(contents.subarray(0, 8), () => socket?.destroy());
      return;
    }
    response.setHeader('ETag', '"browser-source"');
    if (url.pathname === '/slow') {
      const start = request.headers.range
        ? Number(request.headers.range.replace('bytes=', '').replace('-', ''))
        : 0;
      if (!Number.isInteger(start) || start < 0 || start >= slowContents.length) {
        response.statusCode = 416;
        response.end();
        return;
      }
      response.setHeader('Content-Length', String(slowContents.length - start));
      if (start) {
        response.statusCode = 206;
        response.setHeader(
          'Content-Range',
          `bytes ${start}-${slowContents.length - 1}/${slowContents.length}`,
        );
      }
      let offset = start;
      let timer: ReturnType<typeof setTimeout> | undefined;
      response.on('close', () => {
        if (timer) clearTimeout(timer);
      });
      const write = () => {
        if (response.destroyed) return;
        const end = Math.min(offset + 8192, slowContents.length);
        response.write(slowContents.subarray(offset, end));
        offset = end;
        if (offset < slowContents.length) timer = setTimeout(write, 10);
        else response.end();
      };
      write();
      return;
    }
    response.end(contents);
  });
  await new Promise<void>((resolveReady) => source.listen(0, '127.0.0.1', resolveReady));
  const address = source.address();
  if (!address || typeof address === 'string') throw new Error('本地来源夹具未启动');
  origin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  source.closeAllConnections();
  await new Promise<void>((resolveClosed, reject) =>
    source.close((error) => (error ? reject(error) : resolveClosed())),
  );
});

async function login(page: Page) {
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
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}
async function api(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<Record<string, unknown>> {
  const result = await page.evaluate(
    async ({ path, method, body }) => {
      const csrf = (await (
        await fetch('/api/console/v1/auth/csrf', { credentials: 'include', cache: 'no-store' })
      ).json()) as { token: string };
      const response = await fetch('/api/console/v1/native/files' + path, {
        method,
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, value: (await response.json()) as Record<string, unknown> };
    },
    { path, method, body },
  );
  expect(result.status, method + ' ' + path).toBe(200);
  return result.value;
}

test('离线入口、目录选择、实际服务器下载、详情复制、查看结果和保留文件清理', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await login(page);
  const suffix = randomUUID().slice(0, 8);
  const folderName = '下载目录-' + suffix;
  const folder = await api(page, '/folders', 'POST', { parentId: '', name: folderName });
  await page.getByRole('link', { name: '离线下载', exact: true }).click();
  await expect(page).toHaveURL(/\/home\/downloads$/);
  await expect(page.getByRole('heading', { name: '离线下载', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '新建离线下载任务', exact: true })).toBeEnabled();
  await page.getByText('自动刷新', { exact: true }).click();
  await expect(page.getByRole('switch', { name: '自动刷新', exact: true })).not.toBeChecked();
  await page.screenshot({ path: '../.data/129-downloads-empty.png', fullPage: true });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: '新建离线下载任务', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新建离线下载任务', exact: true });
  const uri =
    origin +
    '/file?signature=browser-private&name=' +
    encodeURIComponent('auto-' + suffix + '.txt');
  await dialog.getByLabel('下载链接', { exact: true }).fill(uri);
  await dialog.getByRole('button', { name: '设置保存名称', exact: true }).click();
  await dialog.getByLabel('保存名称（可选）', { exact: true }).fill('云端-' + suffix + '.txt');
  await dialog.getByRole('button', { name: /^下载至/ }).click();
  await dialog.getByRole('button', { name: folderName + '/', exact: true }).click();
  await page.screenshot({ path: '../.data/129-downloads-create.png' });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const row = page.locator('[data-download-id]').filter({ hasText: '云端-' + suffix + '.txt' });
  await expect
    .poll(async () => {
      await page.getByRole('button', { name: '刷新任务', exact: true }).click();
      return row.getByText('已完成', { exact: true }).isVisible();
    })
    .toBe(true);
  await expect(row).toContainText('/' + folderName);
  await expect(row.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('body')).not.toContainText('browser-private');
  await row.getByRole('button', { name: '任务详情', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '云端-' + suffix + '.txt', exact: true });
  await expect(drawer).toContainText('尝试次数');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await drawer.getByRole('button', { name: '复制原始链接', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(uri);
  await drawer.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('heading', { name: '离线下载', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: '../.data/129-downloads-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await row.getByRole('button', { name: '查看下载文件', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('/home\\?parent=' + String(folder.id)));
  await expect(page.getByText('云端-' + suffix + '.txt', { exact: true }).first()).toBeVisible();
  await page.goto('/home/downloads');
  await row.getByRole('button', { name: '移除记录', exact: true }).click();
  const remove = page.getByRole('dialog', { name: '移除记录', exact: true });
  await expect(remove).toContainText('已保存的文件会保留');
  await remove.getByRole('button', { name: '确定', exact: true }).click();
  await expect(row).toHaveCount(0);
  const listing = await api(page, '?parent=' + String(folder.id));
  expect(
    (listing.items as { name: string }[]).some((entry) => entry.name === '云端-' + suffix + '.txt'),
  ).toBe(true);
  await page.goto('/workspace');
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await page.goto('/home/downloads');
  await expect(page.getByRole('heading', { name: 'Offline downloads', exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'New offline download', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: '../.data/129-downloads-dark-english-mobile.png' });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Current user', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Language English', exact: true }).click();
  await page.getByRole('menuitemradio', { name: '简体中文', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '浅色', exact: true }).click();
  expect(failures).toEqual([]);
});

test('逐行批量链接逐项报错、自动命名、筛选与批量清理保留已下载文件', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  const suffix = randomUUID().slice(0, 8),
    filename = 'batch-' + suffix + '.txt';
  await page.goto('/home/downloads');
  await page.getByRole('button', { name: '新建离线下载任务', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新建离线下载任务', exact: true });
  await dialog
    .getByLabel('下载链接', { exact: true })
    .fill(origin + '/file?name=' + filename + '\nfile:///blocked-source');
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  await expect(dialog).toContainText('部分链接未能创建');
  await expect(dialog.getByLabel('下载链接', { exact: true })).toHaveValue(
    'file:///blocked-source',
  );
  await expect(dialog.getByRole('status')).toContainText('2.');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  const row = page.locator('[data-download-id]').filter({ hasText: filename });
  await expect
    .poll(async () => {
      await page.getByRole('button', { name: '刷新任务', exact: true }).click();
      return row.getByText('已完成', { exact: true }).isVisible();
    })
    .toBe(true);
  await page.getByLabel('搜索任务名称或来源站点', { exact: true }).fill(filename);
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page.locator('[data-download-id]')).toHaveCount(1);
  await row.locator('[data-slot="checkbox-content"]').click();
  await expect(row.getByRole('checkbox')).toBeChecked();
  await page.getByRole('button', { name: '清理所选记录', exact: true }).click();
  await page
    .getByRole('dialog', { name: '移除记录', exact: true })
    .getByRole('button', { name: '确定', exact: true })
    .click();
  await expect(row).toHaveCount(0);
  const listing = await api(page, '?search=' + filename + '&scope=all');
  expect((listing.items as { name: string }[]).some((entry) => entry.name === filename)).toBe(true);
});

test('不可靠前缀显式从头下载、真实进度和批量暂停继续取消', async ({ page }) => {
  test.setTimeout(150_000);
  await login(page);
  const suffix = randomUUID().slice(0, 8);
  await page.goto('/home/downloads');
  await expect(page.getByRole('button', { name: '新建离线下载任务', exact: true })).toBeEnabled();
  await page.getByText('自动刷新', { exact: true }).click();
  async function create(uris: string) {
    await page.getByRole('button', { name: '新建离线下载任务', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '新建离线下载任务', exact: true });
    await dialog.getByLabel('下载链接', { exact: true }).fill(uris);
    const response = page.waitForResponse(
      (response) =>
        response.url().endsWith('/native/files/downloads/batch-create') &&
        response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: '确定', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    return ((await (await response).json()) as { items: { task: { id: string } }[] }).items.map(
      (item) => item.task.id,
    );
  }
  const retryName = 'restart-' + suffix + '.txt';
  const retryIDs = await create(origin + '/flaky?name=' + retryName);
  const retryRow = page.locator(`[data-download-id="${retryIDs[0]}"]`);
  await expect
    .poll(
      async () => {
        await page.getByRole('button', { name: '刷新任务', exact: true }).click();
        return retryRow.getByText('失败', { exact: true }).isVisible();
      },
      { timeout: 25_000 },
    )
    .toBe(true);
  await expect(retryRow).toContainText('来源未提供可靠的续传验证信息');
  await expect(retryRow.getByRole('button', { name: '重试', exact: true })).toBeDisabled();
  const targetName = '修正目录-' + suffix;
  await api(page, '/folders', 'POST', { parentId: '', name: targetName });
  await retryRow.getByRole('button', { name: '修改保存目标', exact: true }).click();
  const targetDialog = page.getByRole('dialog', { name: '修改保存目标', exact: true });
  await targetDialog.getByLabel('保存名称', { exact: true }).fill('fixed-' + suffix + '.txt');
  await targetDialog.getByRole('button', { name: targetName + '/', exact: true }).click();
  await targetDialog.getByRole('button', { name: '确定', exact: true }).click();
  await expect(targetDialog).toHaveCount(0);
  await expect(retryRow).toContainText('/' + targetName);
  await retryRow.getByRole('button', { name: '从头下载', exact: true }).click();
  await page
    .getByRole('dialog', { name: '从头下载', exact: true })
    .getByRole('button', { name: '确定', exact: true })
    .click();
  await expect
    .poll(async () => {
      await page.getByRole('button', { name: '刷新任务', exact: true }).click();
      return retryRow.getByText('已完成', { exact: true }).isVisible();
    })
    .toBe(true);
  const names = ['slow-' + suffix + '-1.bin', 'slow-' + suffix + '-2.bin'];
  const ids = await create(names.map((name) => origin + '/slow?name=' + name).join('\n'));
  const rows = ids.map((id) => page.locator(`[data-download-id="${id}"]`));
  await expect
    .poll(
      async () => {
        await page.getByRole('button', { name: '刷新任务', exact: true }).click();
        // 同批任务由持久调度顺序领取；未知总量的queued项没有伪造进度条。
        for (const row of rows) {
          const progress = row.getByRole('progressbar');
          if (!(await progress.count())) continue;
          const percentage = Number(await progress.getAttribute('aria-valuenow'));
          if (percentage > 0 && percentage < 100) return true;
        }
        return false;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  for (const row of rows) {
    await row.locator('[data-slot="checkbox-content"]').click();
  }
  await page.getByRole('button', { name: '暂停所选', exact: true }).click();
  await expect
    .poll(async () => {
      await page.getByRole('button', { name: '刷新任务', exact: true }).click();
      return Promise.all(rows.map((row) => row.getByText('已暂停', { exact: true }).isVisible()));
    })
    .toEqual([true, true]);
  for (const row of rows) {
    await row.locator('[data-slot="checkbox-content"]').click();
  }
  await page.getByRole('button', { name: '继续所选', exact: true }).click();
  await expect
    .poll(async () => {
      await page.getByRole('button', { name: '刷新任务', exact: true }).click();
      return Promise.all(rows.map((row) => row.getByText('已暂停', { exact: true }).isVisible()));
    })
    .toEqual([false, false]);
  for (const row of rows) {
    await row.locator('[data-slot="checkbox-content"]').click();
  }
  await page.getByRole('button', { name: '取消所选', exact: true }).click();
  await page
    .getByRole('dialog', { name: '取消下载', exact: true })
    .getByRole('button', { name: '确定', exact: true })
    .click();
  await expect
    .poll(async () => {
      await page.getByRole('button', { name: '刷新任务', exact: true }).click();
      return Promise.all(rows.map((row) => row.getByText('已取消', { exact: true }).isVisible()));
    })
    .toEqual([true, true]);
  await page.screenshot({ path: '../.data/129-downloads-controls.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '文件导航', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '文件导航', exact: true })).toBeVisible();
  await page
    .getByRole('dialog', { name: '文件导航', exact: true })
    .getByRole('button', { name: '关闭', exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test('21链接限制、真实任务游标分页、状态筛选及整页清理', async ({ page }) => {
  test.setTimeout(150_000);
  await login(page);
  const prefix = 'pages-' + randomUUID().slice(0, 8);
  const folder = await api(page, '/folders', 'POST', { parentId: '', name: prefix });
  await page.goto('/home/downloads');
  await page.getByRole('button', { name: '新建离线下载任务', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新建离线下载任务', exact: true });
  await dialog
    .getByLabel('下载链接', { exact: true })
    .fill(Array.from({ length: 21 }, (_, index) => origin + '/file?index=' + index).join('\n'));
  await expect(dialog.getByRole('button', { name: '确定', exact: true })).toBeDisabled();
  await expect(dialog).toContainText('每次最多 20 个链接');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  let remaining = Array.from({ length: 20 }, (_, index) => ({
    uri: origin + '/file',
    name: prefix + '-' + index + '.txt',
    parentId: String(folder.id),
    clientKey: randomUUID(),
  }));
  const ids: string[] = [];
  for (let admissionAttempt = 0; remaining.length && admissionAttempt < 3; admissionAttempt++) {
    const created = await api(page, '/downloads/batch-create', 'POST', { items: remaining });
    const results = created.items as {
      clientKey: string;
      errorCode: string;
      task?: { id: string };
    }[];
    for (const item of results) {
      if (item.task) ids.push(item.task.id);
      else expect(item.errorCode).toBe('files_busy');
    }
    remaining = remaining.filter((input) =>
      results.some((result) => result.clientKey === input.clientKey && result.errorCode),
    );
    await expect
      .poll(
        async () => {
          const records = await api(page, '/downloads?search=' + prefix);
          return (records.items as { state: string }[]).every((item) => item.state === 'completed');
        },
        { timeout: 45_000, intervals: [500] },
      )
      .toBe(true);
  }
  expect(remaining).toHaveLength(0);
  const last = await api(page, '/downloads', 'POST', {
    uri: origin + '/file',
    name: prefix + '-20.txt',
    parentId: folder.id,
    clientKey: randomUUID(),
  });
  ids.push(String(last.id));
  await expect
    .poll(async () => (await api(page, '/downloads/' + String(last.id))).state)
    .toBe('completed');
  await page.getByLabel('搜索任务名称或来源站点', { exact: true }).fill(prefix);
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page.locator('[data-download-id]')).toHaveCount(20);
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page.locator('[data-download-id]')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '下一页', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '上一页', exact: true }).click();
  await expect(page.locator('[data-download-id]')).toHaveCount(20);
  await page.getByRole('button', { name: /任务状态/ }).click();
  await page.getByRole('option', { name: '已完成', exact: true }).click();
  await expect(page.locator('[data-download-id]')).toHaveCount(20);
  await page.getByText('选择本页全部任务', { exact: true }).click();
  await page.getByRole('button', { name: '清理所选记录', exact: true }).click();
  await page
    .getByRole('dialog', { name: '移除记录', exact: true })
    .getByRole('button', { name: '确定', exact: true })
    .click();
  await expect(page.locator('[data-download-id]')).toHaveCount(1);
  await page.getByText('选择本页全部任务', { exact: true }).click();
  await page.getByRole('button', { name: '清理所选记录', exact: true }).click();
  await page
    .getByRole('dialog', { name: '移除记录', exact: true })
    .getByRole('button', { name: '确定', exact: true })
    .click();
  await expect(page.locator('[data-download-id]')).toHaveCount(0);
  const saved = await api(page, '?parent=' + String(folder.id));
  expect(saved.total).toBe(21);
  expect(new Set(ids).size).toBe(21);
});
