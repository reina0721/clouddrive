import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

type Folder = { id: string; parentId: string; name: string; contentRevision: number };
async function login(page: Page, accessPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS) {
  const access = JSON.parse(
    (
      await readFile(resolve(__dirname, accessPath ?? '../../.data/preview-access.json'), 'utf8')
    ).replace(/^\uFEFF/, ''),
  ) as { username: string; password: string };
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}
async function mutate(page: Page, path: string, method: string, body?: unknown): Promise<Folder> {
  const result = await page.evaluate(
    async ({ path, method, body }) => {
      const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
      const response = await fetch('/api/console/v1/native/files' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, value: (await response.json()) as Folder };
    },
    { path, method, body },
  );
  expect(result.status).toBe(200);
  return result.value;
}
const createFolder = (page: Page, name: string, parentId = '') =>
  mutate(page, '/folders', 'POST', { parentId, name });
const tree = (page: Page) => page.getByRole('treegrid', { name: '目录树', exact: true });
const row = (view: Locator, name: string) =>
  view.getByRole('row').filter({ has: view.page().getByText(name, { exact: true }) });
async function openRoot(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('button', { name: /^(展开|收起)我的文件目录树$/ })).toBeVisible();
  const expand = page.getByRole('button', { name: '展开我的文件目录树', exact: true });
  if (await expand.isVisible()) {
    await expand.click();
    await expect(
      page.getByRole('button', { name: '收起我的文件目录树', exact: true }),
    ).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(tree(page)).toBeVisible();
  await expect(tree(page).getByText('正在读取子目录', { exact: true })).toHaveCount(0);
}
async function expand(page: Page, name: string) {
  await tree(page)
    .getByRole('button', { name: '展开 ' + name, exact: true })
    .click();
  await expect(tree(page).getByText('正在读取子目录', { exact: true })).toHaveCount(0);
}

test('F341–344/351–353：真实文件夹过滤、逐层加载与51项目分页', async ({ page }, info) => {
  test.setTimeout(180_000);
  await login(page);
  const root = await createFolder(page, '树分页-' + randomUUID().slice(0, 8));
  const children: Folder[] = [];
  for (let index = 0; index < 51; index++)
    children.push(await createFolder(page, '目录-' + String(index).padStart(2, '0'), root.id));
  await mutate(page, '/text', 'POST', {
    parentId: root.id,
    name: '不属于目录树.txt',
    text: 'real content',
    key: randomUUID(),
  });
  const trashed = await createFolder(page, '不显示的回收目录', root.id);
  await mutate(page, '/' + trashed.id + '/trash', 'POST');
  const queryReads: { parent: string; page: string }[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === '/api/console/v1/native/files' &&
      url.searchParams.getAll('kinds').includes('folder')
    )
      queryReads.push({
        parent: url.searchParams.get('parent') ?? '',
        page: url.searchParams.get('page') ?? '',
      });
  });
  await page.reload();
  await openRoot(page);
  await expect(row(tree(page), root.name)).toBeVisible();
  expect(queryReads.filter((value) => value.parent === root.id)).toHaveLength(0);
  await expand(page, root.name);
  await expect(tree(page).getByText('目录-49', { exact: true })).toBeVisible();
  await expect(tree(page).getByText('目录-50', { exact: true })).toHaveCount(0);
  await expect(tree(page).getByText('不属于目录树.txt', { exact: true })).toHaveCount(0);
  await expect(tree(page).getByText('不显示的回收目录', { exact: true })).toHaveCount(0);
  await tree(page).getByText('载入更多子目录（50 / 51）', { exact: true }).click();
  await expect(tree(page).getByText('目录-50', { exact: true })).toBeVisible();
  await expect(tree(page).getByText('目录-00', { exact: true })).toHaveCount(1);
  expect(queryReads.filter((value) => value.parent === root.id).map((value) => value.page)).toEqual(
    ['1', '2'],
  );
  await tree(page)
    .getByRole('button', { name: '收起 ' + root.name, exact: true })
    .click();
  await expect(tree(page).getByText('目录-00', { exact: true })).toHaveCount(0);
  await expand(page, root.name);
  expect(queryReads.filter((value) => value.parent === root.id)).toHaveLength(2);
  await expand(page, children[0]!.name);
  await expect(
    tree(page).getByRole('button', { name: '展开 ' + children[0]!.name, exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '收起我的文件目录树', exact: true }).click();
  await expect(tree(page)).toHaveCount(0);
  await openRoot(page);
  expect(queryReads.filter((value) => value.parent === root.id)).toHaveLength(2);
  await page.screenshot({ path: info.outputPath('tree-pagination.png') });
});

test('F345–348：真实路径跟随、点击、方向键与Enter激活', async ({ page }, info) => {
  await login(page);
  const root = await createFolder(page, '树路径-' + randomUUID().slice(0, 8));
  const child = await createFolder(page, '路径子目录', root.id);
  const leaf = await createFolder(page, '路径末级', child.id);
  await page.goto('/home?parent=' + leaf.id);
  await expect(tree(page)).toBeVisible();
  await expect(row(tree(page), leaf.name)).toHaveAttribute('aria-selected', 'true');
  await expect(
    tree(page).getByRole('button', { name: '收起 ' + root.name, exact: true }),
  ).toBeVisible();
  await expect(
    tree(page).getByRole('button', { name: '收起 ' + child.name, exact: true }),
  ).toBeVisible();
  await row(tree(page), child.name).click();
  await expect(page).toHaveURL(new RegExp('parent=' + child.id + '$'));
  const current = row(tree(page), child.name);
  await current.focus();
  await page.keyboard.press('ArrowDown');
  await expect(row(tree(page), leaf.name)).toBeFocused();
  await expect(page).toHaveURL(new RegExp('parent=' + child.id + '$'));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp('parent=' + leaf.id + '$'));
  await row(tree(page), root.name).focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(new RegExp('parent=' + root.id + '$'));
  await row(tree(page), root.name).focus();
  await page.keyboard.press('Home');
  await expect(tree(page).getByRole('row').first()).toBeFocused();
  await page.keyboard.press('End');
  await expect(tree(page).getByRole('row').last()).toBeFocused();
  await expect(page).toHaveURL(new RegExp('parent=' + root.id + '$'));
  await page.getByRole('checkbox', { name: '选择 ' + child.name, exact: true }).press('Space');
  await row(tree(page), root.name).focus();
  for (const key of ['Delete', 'F2', 'Control+a']) {
    await page.keyboard.press(key);
    await expect(row(tree(page), root.name)).toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await expect(
    page.getByRole('checkbox', { name: '选择 ' + child.name, exact: true }),
  ).toBeChecked();
  await page.screenshot({ path: info.outputPath('tree-current-path.png') });
});

test('F349/350/360：设备开关、旧偏好迁移与账号隔离', async ({ page, browser }) => {
  await login(page);
  const root = await createFolder(page, '树设备-' + randomUUID().slice(0, 8));
  const child = await createFolder(page, '不自动跟随', root.id);
  await openRoot(page);
  await page.getByLabel('自动展开当前目录', { exact: true }).press('Space');
  await page.goto('/home?parent=' + child.id);
  await expect(page.getByRole('button', { name: '展开我的文件目录树', exact: true })).toBeVisible();
  await openRoot(page);
  await expect(
    tree(page).getByRole('button', { name: '展开 ' + root.name, exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('自动展开当前目录', { exact: true })).not.toBeChecked();
  await page.reload();
  await openRoot(page);
  await expect(page.getByLabel('自动展开当前目录', { exact: true })).not.toBeChecked();
  const adminPath = process.env.CLOUDDRIVE_FILE_TEST_ADMIN_ACCESS;
  if (!adminPath) throw Error('An isolated administrator access file is required');
  const other = await browser.newContext();
  try {
    const admin = await other.newPage();
    await login(admin, adminPath);
    await openRoot(admin);
    await expect(admin.getByLabel('自动展开当前目录', { exact: true })).toBeChecked();
  } finally {
    await other.close();
  }
  const access = JSON.parse(
    (await readFile(resolve(process.env.CLOUDDRIVE_FILE_TEST_ACCESS!), 'utf8')).replace(
      /^\uFEFF/,
      '',
    ),
  ) as { userId: string };
  await page.evaluate((account) => {
    localStorage.removeItem('clouddrive.files.sidebar.v2.' + account);
    localStorage.setItem('clouddrive.files.sidebar.v1.' + account, 'true');
  }, access.userId);
  await page.reload();
  await expect(page.getByRole('button', { name: '展开文件导航', exact: true })).toBeVisible();
  const saved = await page.evaluate(
    (account) => ({
      old: localStorage.getItem('clouddrive.files.sidebar.v1.' + account),
      current: JSON.parse(
        localStorage.getItem('clouddrive.files.sidebar.v2.' + account) ?? 'null',
      ) as unknown,
    }),
    access.userId,
  );
  expect(saved.old).toBeNull();
  expect(saved.current).toEqual({ collapsed: true, autoExpandTree: true });
});

test('F354：失败不冒充空目录，可在同一分支重试', async ({ page }) => {
  await login(page);
  const root = await createFolder(page, '树错误-' + randomUUID().slice(0, 8));
  const child = await createFolder(page, '恢复后的目录', root.id);
  let fail = true;
  await page.route('**/native/files?*', async (route) => {
    const url = new URL(route.request().url());
    if (
      fail &&
      url.searchParams.get('parent') === root.id &&
      url.searchParams.getAll('kinds').includes('folder')
    )
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'files_unavailable', message: 'unavailable' }),
      });
    else await route.continue();
  });
  await page.reload();
  await openRoot(page);
  await expand(page, root.name);
  await expect(tree(page).getByText('重试此目录', { exact: true })).toBeVisible();
  await expect(tree(page).getByText(child.name, { exact: true })).toHaveCount(0);
  fail = false;
  await tree(page).getByText('重试此目录', { exact: true }).click();
  await expect(tree(page).getByText(child.name, { exact: true })).toBeVisible();
  await expect(tree(page).getByText('重试此目录', { exact: true })).toHaveCount(0);
});

test('F355–357：工作区创建与改名移动回收刷新，其他页面仍可进入目录', async ({ page }) => {
  await login(page);
  const root = await createFolder(page, '树变化-' + randomUUID().slice(0, 8));
  const child = await createFolder(page, '改名前目录', root.id);
  const target = await createFolder(page, '移动目的地', root.id);
  await page.goto('/home?parent=' + root.id);
  await expect(tree(page).getByText(child.name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '创建文件夹', exact: true }).click();
  await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill('由界面新建');
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(tree(page).getByText('由界面新建', { exact: true })).toBeVisible();
  const renamed = await mutate(page, '/' + child.id, 'PATCH', {
    name: '改名后目录',
    expectedRevision: child.contentRevision,
  });
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(tree(page).getByText('改名后目录', { exact: true })).toBeVisible();
  await expect(tree(page).getByText(child.name, { exact: true })).toHaveCount(0);
  await mutate(page, '/' + child.id, 'PATCH', {
    parentId: target.id,
    expectedRevision: renamed.contentRevision,
  });
  await page.getByRole('button', { name: '刷新目录树', exact: true }).click();
  await expect(tree(page).getByText('改名后目录', { exact: true })).toHaveCount(0);
  await expand(page, target.name);
  await expect(tree(page).getByText('改名后目录', { exact: true })).toBeVisible();
  await mutate(page, '/' + child.id + '/trash', 'POST');
  await page.getByRole('button', { name: '刷新目录树', exact: true }).click();
  await expect(row(tree(page), target.name)).toBeVisible();
  await expect(row(tree(page), target.name)).not.toHaveAttribute('aria-expanded', 'true');
  await expect(tree(page).getByText('改名后目录', { exact: true })).toHaveCount(0);
  for (const label of ['我的分享', '连接与挂载', '传输中心', '离线下载', '与我共享']) {
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(tree(page)).toBeVisible();
  }
  await row(tree(page), root.name).click();
  await expect(page).toHaveURL(new RegExp('parent=' + root.id + '$'));
});

test('F358/359：移动导航、长名称、英文深色与无障碍', async ({ page }, info) => {
  await login(page);
  const root = await createFolder(
    page,
    '树窄屏-' + randomUUID().slice(0, 8) + '-长名称-'.repeat(20),
  );
  const child = await createFolder(page, '移动目录', root.id);
  await page.goto('/home?parent=' + child.id);
  await expect(tree(page)).toBeVisible();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('button', { name: 'File navigation', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'File navigation', exact: true });
  const mobileTree = drawer.getByRole('treegrid', { name: 'Folder tree', exact: true });
  await expect(mobileTree).toBeVisible();
  await expect(mobileTree.getByText(root.name, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('tree-mobile-dark-english.png') });
  await mobileTree.getByText(root.name, { exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp('parent=' + root.id + '$'));
  await expect(
    page.getByRole('heading', { level: 1, name: root.name, exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator('#main-content')).toBeFocused();
});

test('F345/357：目录树导航保留同一真实上传及原目标', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  const source = await createFolder(page, '树上传原目标-' + randomUUID().slice(0, 8));
  const target = await createFolder(page, '树上传导航目标-' + randomUUID().slice(0, 8));
  await page.goto('/home?parent=' + source.id);
  await expect(row(tree(page), target.name)).toBeVisible();
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  let waiting = false;
  let admissions = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/console/v1/native/files/transfers'
    )
      admissions++;
  });
  await page.route('**/native/files/transfers/*/data', async (route) => {
    if (route.request().method() === 'PATCH') {
      waiting = true;
      await gate;
    }
    await route.continue();
  });
  const bytes = Buffer.from('real directory tree transfer\n'.repeat(20000));
  try {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '新建', exact: true }).click();
    await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
    await (
      await chooser
    ).setFiles({ name: 'tree-transfer.txt', mimeType: 'text/plain', buffer: bytes });
    await expect.poll(() => waiting).toBe(true);
    await page
      .getByRole('dialog', { name: '上传队列', exact: true })
      .getByRole('button', { name: '关闭', exact: true })
      .click();
    await row(tree(page), target.name).click();
    await expect(page).toHaveURL(new RegExp('parent=' + target.id + '$'));
    await page.getByRole('button', { name: /^上传队列/ }).click();
    const upload = page.locator('[data-transfer-id]').filter({ hasText: 'tree-transfer.txt' });
    await expect(upload).toBeVisible();
    release?.();
    await expect(upload).toContainText('上传完成');
    expect(admissions).toBe(1);
    const received = await page.evaluate(
      async ({ source, target }) => {
        const read = async (parent: string) =>
          (await (
            await fetch(
              '/api/console/v1/native/files?' +
                new URLSearchParams({ parent, page: '1', pageSize: '50' }).toString(),
            )
          ).json()) as { items: { id: string; name: string }[] };
        const original = await read(source),
          navigated = await read(target);
        const entry = original.items.find((item) => item.name === 'tree-transfer.txt');
        if (!entry) throw Error('Original upload destination missing');
        const response = await fetch('/api/console/v1/native/files/' + entry.id + '/content');
        if (!response.ok) throw Error('Actual uploaded content unavailable');
        return {
          names: navigated.items.map((item) => item.name),
          bytes: Array.from(new Uint8Array(await response.arrayBuffer())),
        };
      },
      { source: source.id, target: target.id },
    );
    expect(received.names).not.toContain('tree-transfer.txt');
    expect(Buffer.from(received.bytes)).toEqual(bytes);
  } finally {
    release?.();
  }
});
