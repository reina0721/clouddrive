import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
const accessPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS!;
type FixtureEntry = { id: string; name: string; contentRevision: number };
async function api<T>(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
      const r = await fetch('/api/console/v1/native/files' + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!r.ok) throw new Error('fixture status ' + r.status);
      return (await r.json()) as T;
    },
    { path, body },
  );
}
async function upload(page: Page, name: string, path: string) {
  const event = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  await (
    await event
  ).setFiles({ name, mimeType: 'application/octet-stream', buffer: await readFile(path) });
  const queue = page.getByRole('dialog', { name: '上传队列', exact: true });
  await expect(queue.getByText('上传完成', { exact: true })).toBeVisible();
  await queue.getByRole('button', { name: '关闭', exact: true }).click();
  // 复用持续运行的 QA 目录时，新夹具不一定排在当前列表页。
  await page.goto('/home?search=' + encodeURIComponent(name));
  await page.getByRole('button', { name, exact: true }).click();
  return page.getByRole('dialog', { name, exact: true });
}
test.beforeEach(async ({ page }) => {
  const a = JSON.parse((await readFile(accessPath, 'utf8')).replace(/^\uFEFF/, '')) as {
    username: string;
    password: string;
  };
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(a.username);
  await page.getByLabel('密码', { exact: true }).fill(a.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
});
const fixture = resolve(__dirname, 'fixtures/archives/browser.zip');

test('F461–F465/468–469/473–475：独立任务页、刷新、全包解压与持久结果', async ({ page }, info) => {
  const taskLink = page.getByRole('link', { name: '后台任务', exact: true });
  await taskLink.click();
  await expect(page.getByRole('heading', { name: '后台任务', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '刷新任务', exact: true })).toBeEnabled();
  const auto = page.getByRole('switch', { name: '自动刷新', exact: true });
  await expect(auto).toBeChecked();
  await auto.press('Space');
  await expect(auto).not.toBeChecked();
  await page.getByRole('button', { name: '刷新任务', exact: true }).click();
  await auto.press('Space');
  await expect(auto).toBeChecked();
  await page.goto('/home');
  const targetName = '000-background-target-' + Date.now();
  const target = await api<{ id: string }>(page, '/folders', { parentId: '', name: targetName });
  const sourceName = 'background-' + Date.now() + '.zip';
  const archive = await upload(page, sourceName, fixture);
  await archive.getByRole('button', { name: '全部解压', exact: true }).click();
  const extract = page.getByRole('dialog', { name: '解压到目录', exact: true });
  await extract.getByRole('button', { name: '进入 ' + targetName, exact: true }).click();
  await extract.getByLabel('新建包裹文件夹（可留空）', { exact: true }).fill('wrapped');
  await extract.getByText('在后台解压', { exact: true }).click();
  await expect(extract.getByRole('checkbox', { name: '在后台解压', exact: true })).toBeChecked();
  await extract.getByRole('button', { name: '提交后台解压', exact: true }).click();
  await expect(archive.getByText('已提交后台解压 ' + sourceName, { exact: true })).toBeVisible();
  await archive.getByRole('button', { name: '查看后台任务', exact: true }).click();
  await expect(page).toHaveURL(/\/home\/tasks$/);
  const row = page.getByRole('listitem').filter({ hasText: sourceName });
  await expect(row.getByText('已完成', { exact: true })).toBeVisible();
  await expect(row).toContainText('已创建 5 项');
  await page.reload();
  await expect(row.getByText('已完成', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: info.outputPath('archive-task-mobile.png'),
    animations: 'disabled',
  });
  await row.getByRole('link', { name: '打开结果目录', exact: true }).click();
  await expect(page.getByRole('button', { name: 'root.txt', exact: true })).toBeVisible();
  const children = await api<{ items: FixtureEntry[] }>(page, '?parent=' + target.id);
  expect(children.items.map((entry) => entry.name)).toEqual(['wrapped']);
});

test('F466/470–472/477：只解压选中成员、同名规则和请求重放', async ({ page }) => {
  const name = 'selected-background-' + Date.now() + '.zip';
  await upload(page, name, fixture);
  const listing = await api<{ items: FixtureEntry[] }>(page, '?search=' + name);
  const source = listing.items.find((entry) => entry.name === name);
  if (!source) throw new Error('archive fixture missing');
  const folder = await api<{ id: string }>(page, '/folders', {
    parentId: '',
    name: name + '-target',
  });
  type Job = {
    id: string;
    state: string;
    createdCount: number;
    skippedCount: number;
    renamedCount: number;
    failureCode: string;
  };
  const makeInput = (conflict: string) => ({
    clientKey: crypto.randomUUID(),
    expectedRevision: source.contentRevision,
    selection: { mode: 'selected', paths: ['root.txt'] },
    parentId: folder.id,
    folderName: '',
    conflict,
  });
  const queue = (input: ReturnType<typeof makeInput>) =>
    api<Job>(page, '/' + source.id + '/archive/tasks', input);
  const read = (job: Job) => api<Job>(page, '/archive-tasks/' + job.id);
  const wait = async (job: Job, state: string) => {
    await expect.poll(async () => (await read(job)).state, { timeout: 20000 }).toBe(state);
    return read(job);
  };
  const input = makeInput('reject');
  const initial = await queue(input);
  expect((await queue(input)).id).toBe(initial.id);
  expect((await wait(initial, 'completed')).createdCount).toBe(1);
  expect((await wait(await queue(makeInput('reject')), 'failed')).failureCode).toBe('conflict');
  expect((await wait(await queue(makeInput('skip')), 'completed')).skippedCount).toBe(1);
  expect((await wait(await queue(makeInput('rename')), 'completed')).renamedCount).toBe(1);
  const contents = await api<{ items: FixtureEntry[] }>(page, '?parent=' + folder.id);
  expect(contents.items.map((entry) => entry.name).sort()).toEqual(['root (1).txt', 'root.txt']);
});

test('F467/480：普通7Z后台解压，有密码7Z保留当前页面解压', async ({ page }) => {
  const archivePath = (fixtureName: string) =>
    resolve(
      __dirname,
      '../../internal/module/files/adapter/archiveprocess/testdata/sevenzip',
      fixtureName,
    );
  const name = 'background-7z-' + Date.now() + '.7z';
  const plain = await upload(page, name, archivePath('t0.7z'));
  await plain.getByRole('button', { name: '全部解压', exact: true }).click();
  let extract = page.getByRole('dialog', { name: '解压到目录', exact: true });
  await extract.getByLabel('新建包裹文件夹（可留空）', { exact: true }).fill(name + '-result');
  await extract.getByText('在后台解压', { exact: true }).click();
  await expect(extract.getByRole('checkbox', { name: '在后台解压', exact: true })).toBeChecked();
  await extract.getByRole('button', { name: '提交后台解压', exact: true }).click();
  await plain.getByRole('button', { name: '查看后台任务', exact: true }).click();
  await expect(
    page.getByRole('listitem').filter({ hasText: name }).getByText('已完成', { exact: true }),
  ).toBeVisible();
  await page.goto('/home');
  const lockedName = 'password-7z-' + Date.now() + '.7z';
  const encrypted = await upload(page, lockedName, archivePath('t2.7z'));
  await encrypted.getByLabel('7Z密码（不保存）', { exact: true }).fill('password');
  await encrypted.getByRole('button', { name: /^(读取压缩包|重新读取)$/ }).click();
  await encrypted.getByRole('button', { name: '全部解压', exact: true }).click();
  extract = page.getByRole('dialog', { name: '解压到目录', exact: true });
  await expect(extract.getByRole('checkbox', { name: '在后台解压', exact: true })).toHaveCount(0);
  await extract
    .getByLabel('新建包裹文件夹（可留空）', { exact: true })
    .fill(lockedName + '-result');
  await extract.getByRole('button', { name: '开始解压', exact: true }).click();
  await expect(encrypted.getByRole('region', { name: '解压结果', exact: true })).toBeVisible();
});

test('F241/243–251：真实ZIP浏览、搜索排序选择、安全预览和两种下载', async ({ page }, info) => {
  const d = await upload(page, 'browse-' + Date.now() + '.zip', fixture);
  await expect(d.locator('[data-archive-path]')).toHaveCount(3);
  await d.getByRole('button', { name: 'docs', exact: true }).click();
  await expect(d.locator('[data-archive-path="docs/readme.txt"]')).toBeVisible();
  await d.getByRole('button', { name: '预览文本', exact: true }).click();
  await expect(d.locator('pre')).toContainText('<script>window.archiveExecuted=true</script>');
  expect(await page.evaluate(() => 'archiveExecuted' in window)).toBe(false);
  await d.getByRole('button', { name: '关闭包内预览', exact: true }).click();
  const download = page.waitForEvent('download');
  await d.getByRole('button', { name: '下载成员', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('readme.txt');
  expect(await readFile(await file.path(), 'utf8')).toContain('archive text');
  await d.getByRole('button', { name: '返回包内上一级', exact: true }).click();
  await d.getByRole('searchbox', { name: '搜索包内路径', exact: true }).fill('readme');
  await expect(d.locator('[data-archive-path]')).toHaveCount(1);
  await d.getByRole('button', { name: '全选当前结果', exact: true }).click();
  await expect(
    d.getByRole('checkbox', { name: '选择 docs/readme.txt', exact: true }),
  ).toBeChecked();
  const selected = page.waitForEvent('download');
  await d.getByRole('button', { name: '打包下载所选', exact: true }).click();
  const zipped = await selected;
  const bytes = await readFile(await zipped.path());
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
  await d.getByRole('button', { name: '清空包内选择', exact: true }).click();
  await expect(d.getByRole('button', { name: '解压所选', exact: true })).toBeDisabled();
  await d.getByRole('searchbox', { name: '搜索包内路径', exact: true }).fill('');
  const pixel = d.locator('[data-archive-path="pixel.png"]');
  await pixel.getByRole('button', { name: '预览图像', exact: true }).click();
  await expect(d.getByRole('img', { name: 'pixel.png', exact: true })).toBeVisible();
  expect(
    await d
      .getByRole('img', { name: 'pixel.png', exact: true })
      .evaluate((el: HTMLImageElement) => el.naturalWidth),
  ).toBe(1);
  await d.getByRole('button', { name: '关闭包内预览', exact: true }).click();
  await d.getByRole('button', { name: '名称升序 包内排序', exact: true }).click();
  await page.getByRole('option', { name: '大小降序', exact: true }).click();
  await expect(d.locator('[data-archive-path]').first()).toHaveAttribute(
    'data-archive-path',
    'pixel.png',
  );
  await expect(page.locator('div[role=log] div[role=img]')).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath('archive-desktop.png'),
    fullPage: false,
    animations: 'disabled',
  });

  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 320, height: 780 });
  await page.screenshot({ path: info.outputPath('archive-mobile.png'), fullPage: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('F252/254–260：指定位置、包裹目录、冲突策略、回执及打开结果', async ({ page }) => {
  const target = '000-target-' + Date.now();
  const folder = await api<{ id: string }>(page, '/folders', { parentId: '', name: target });
  const d = await upload(page, 'extract-' + Date.now() + '.zip', fixture);
  async function extract(conflict?: string) {
    await d.getByRole('button', { name: '全部解压', exact: true }).click();
    const e = page.getByRole('dialog', { name: '解压到目录', exact: true });
    await e.getByRole('button', { name: '进入 ' + target, exact: true }).click();
    await expect(e.getByRole('button', { name: '开始解压', exact: true })).toBeEnabled();
    if (conflict) {
      await e.getByRole('button', { name: '拒绝整次操作 同名处理', exact: true }).click();
      await page.getByRole('option', { name: conflict, exact: true }).click();
    }
    return e;
  }
  let e = await extract();
  await e.getByLabel('新建包裹文件夹（可留空）', { exact: true }).fill('wrapped');
  await e.getByRole('button', { name: '开始解压', exact: true }).click();
  await expect(e).toHaveCount(0);
  await expect(d.getByRole('region', { name: '解压结果', exact: true })).toContainText(
    '已创建 5 项',
  );
  e = await extract();
  await e.getByRole('button', { name: '开始解压', exact: true }).click();
  await expect(e).toHaveCount(0);
  e = await extract();
  await e.getByRole('button', { name: '开始解压', exact: true }).click();
  await expect(e.getByRole('alert').first()).toBeVisible();
  const before = await api<{ items: FixtureEntry[] }>(page, '?parent=' + folder.id);
  expect(before.items).toHaveLength(4);
  await e.getByRole('button', { name: '取消', exact: true }).click();
  e = await extract('跳过同名文件');
  await e.getByRole('button', { name: '开始解压', exact: true }).click();
  await expect(e).toHaveCount(0);
  await expect(d.getByRole('region', { name: '解压结果', exact: true })).toContainText(
    '已跳过 3 项',
  );
  e = await extract('自动改名');
  await e.getByRole('button', { name: '开始解压', exact: true }).click();
  await expect(e).toHaveCount(0);
  await expect(d.getByRole('region', { name: '解压结果', exact: true })).toContainText(
    'root.txt → root (1).txt',
  );
  await d.getByRole('button', { name: '打开结果目录', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('parent=' + folder.id));
  await expect(page.getByRole('button', { name: 'root (1).txt', exact: true })).toBeVisible();
});
test('F253：选择目录仅提取后代并保留层级', async ({ page }) => {
  const d = await upload(page, 'selected-' + Date.now() + '.zip', fixture);
  await d.getByRole('checkbox', { name: '选择 docs', exact: true }).press('Space');
  await d.getByRole('button', { name: '解压所选', exact: true }).click();
  const e = page.getByRole('dialog', { name: '解压到目录', exact: true });
  await e.getByLabel('新建包裹文件夹（可留空）', { exact: true }).fill('selection-' + Date.now());
  await e.getByRole('button', { name: '开始解压', exact: true }).click();
  await expect(e).toHaveCount(0);
  await expect(d.getByRole('region', { name: '解压结果', exact: true })).toContainText(
    '已创建 3 项',
  );
  await d.getByRole('button', { name: '打开结果目录', exact: true }).click();
  await expect(page.getByRole('button', { name: 'docs', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'root.txt', exact: true })).toHaveCount(0);
});
for (const n of [0, 2, 4])
  test('F242/259：真实7Z夹具 t' + n + ' 与加密密码重试', async ({ page }) => {
    const d = await upload(
      page,
      '7z-' + n + '-' + Date.now() + '.7z',
      resolve(
        __dirname,
        '../../internal/module/files/adapter/archiveprocess/testdata/sevenzip/t' + n + '.7z',
      ),
    );
    await expect(d.getByLabel('7Z密码（不保存）', { exact: true })).toHaveAttribute(
      'autocomplete',
      'off',
    );
    if (n === 2) {
      await expect(d.getByRole('alert')).toBeVisible();
    }
    if (n !== 0) {
      await d.getByLabel('7Z密码（不保存）', { exact: true }).fill('incorrect');
      await d.getByRole('button', { name: /^(读取压缩包|重新读取)$/ }).click();
      if (n === 4) {
        await expect(d.locator('[data-archive-path]')).not.toHaveCount(0);
        await d.getByRole('button', { name: '预览文本', exact: true }).first().click();
      }
      await expect(d.getByRole('alert')).toBeVisible();
      await d.getByLabel('7Z密码（不保存）', { exact: true }).fill('password');
      await d.getByRole('button', { name: /^(读取压缩包|重新读取)$/ }).click();
    }
    await expect(d.locator('[data-archive-path]')).not.toHaveCount(0);
    await d.getByRole('button', { name: '预览文本', exact: true }).first().click();
    await expect(d.locator('pre')).not.toBeEmpty();
  });

test('HTTP边界：会话、CSRF、源版本与二进制响应头', async ({ page, request }) => {
  const name = 'http-' + Date.now() + '.zip';
  await upload(page, name, fixture);
  const listing = await api<{ items: FixtureEntry[] }>(page, '?search=' + name);
  const entry = listing.items.find((item) => item.name === name);
  if (!entry) throw new Error('uploaded fixture missing');
  const suffix = '/api/console/v1/native/files/' + entry.id + '/archive/';
  const outcomes = await page.evaluate(
    async ({ suffix, revision }) => {
      const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
      const call = async (operation: string, body: unknown, token?: string) =>
        fetch(suffix + operation, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-CSRF-Token': token } : {}),
          },
          body: JSON.stringify(body),
        });
      const missing = await call('inspect', { expectedRevision: revision, password: '' });
      const stale = await call(
        'inspect',
        { expectedRevision: revision + 1, password: '' },
        csrf.token,
      );
      const member = await call(
        'member',
        { expectedRevision: revision, password: '', path: 'root.txt' },
        csrf.token,
      );
      return {
        missing: missing.status,
        stale: stale.status,
        status: member.status,
        cache: member.headers.get('cache-control'),
        sniff: member.headers.get('x-content-type-options'),
        disposition: member.headers.get('content-disposition'),
        content: await member.text(),
      };
    },
    { suffix, revision: entry.contentRevision },
  );
  expect(outcomes).toMatchObject({
    missing: 403,
    stale: 409,
    status: 200,
    cache: 'private, no-store',
    sniff: 'nosniff',
    content: 'root',
  });
  expect(outcomes.disposition).toContain('attachment;');
  const csrf = (await (await request.get('/api/console/v1/auth/csrf')).json()) as { token: string };
  expect(
    (
      await request.post(suffix + 'inspect', {
        headers: {
          Origin: new URL(page.url()).origin,
          'X-CSRF-Token': csrf.token,
          Cookie: '__Host-clouddrive_console_csrf=' + csrf.token,
        },
        data: { expectedRevision: entry.contentRevision, password: '' },
      })
    ).status(),
  ).toBe(401);
});
