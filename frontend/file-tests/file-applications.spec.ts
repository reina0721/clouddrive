import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { FileApplicationView } from '../surfaces/src/files/file-applications';
import { openReadingFixtureFolder } from './reading-fixture';
import { siteProfileAPI } from './site-profile-api';

async function filesAPI<T>(page: Page, path: string, method = 'GET', body?: unknown): Promise<T> {
  return page.evaluate(
    async ({ path, method, body }) => {
      const root = '/api/console/v1';
      const headers = new Headers();
      if (method !== 'GET') {
        const csrf = await fetch(root + '/auth/csrf');
        if (!csrf.ok) throw new Error('Fixture CSRF HTTP ' + csrf.status);
        const { token } = (await csrf.json()) as { token: string };
        headers.set('X-CSRF-Token', token);
        headers.set('Content-Type', 'application/json');
      }
      const response = await fetch(root + '/native/files' + path, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new Error('Fixture HTTP ' + response.status);
      return (await response.json()) as T;
    },
    { path, method, body },
  );
}

async function loginQA(page: Page) {
  const access = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!access, '应用配置只使用隔离预览。');
  const account = JSON.parse((await readFile(access!, 'utf8')).replace(/^\uFEFF/, '')) as {
    username: string;
    password: string;
    url: string;
  };
  expect(new URL(account.url).origin).toBe('http://127.0.0.1:4194');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}

async function openApplications(page: Page) {
  await page.goto('/system-tools/filesystem');
  await page.getByRole('tab', { name: '文件浏览应用', exact: true }).click();
  await expect(page.getByRole('table', { name: '应用列表', exact: true })).toBeVisible();
}

async function preparePublicationFixture(page: Page) {
  const configured = process.env.CLOUDDRIVE_TEST_PUBLICATION_ORIGIN;
  const original = configured ? await siteProfileAPI(page) : undefined;
  return {
    origin: configured ?? new URL(page.url()).origin,
    async activate() {
      if (!configured || !original) return;
      await siteProfileAPI(page, {
        revision: original.revision,
        profile: { ...original.profile, siteAddresses: { primary: configured, alternatives: [] } },
      });
    },
    async restore() {
      if (!original) return;
      const current = await siteProfileAPI(page);
      await siteProfileAPI(page, { revision: current.revision, profile: original.profile });
    },
  };
}

async function restoreApplications(page: Page, initial: FileApplicationView) {
  const current = await filesAPI<FileApplicationView>(page, '/applications');
  await filesAPI(page, '/applications', 'PUT', {
    revision: current.revision,
    apps: initial.items.map(
      ({ id, enabled, platform, customExtensions, extensions, customNewFiles, newFiles }) => ({
        id,
        enabled,
        platform,
        ...(customExtensions ? { extensions } : {}),
        ...(customNewFiles ? { newFiles } : {}),
      }),
    ),
    defaults: initial.defaults,
    webApps: initial.webApps.map((app) => {
      const input = { ...app };
      delete input.origin;
      delete input.editExtensions;
      return input;
    }),
  });
}

test('文件浏览应用保存、默认选择、平台限制和恢复', async ({ page }, info) => {
  await loginQA(page);
  const initial = await filesAPI<FileApplicationView>(page, '/applications');
  await openReadingFixtureFolder(page, '应用验收-');
  const folder = new URL(page.url());
  const parentId = folder.searchParams.get('parent')!;
  const name = '选择阅读器.MD';
  await filesAPI(page, '/text', 'POST', {
    parentId,
    name,
    text: '# 内置文件应用',
    key: randomUUID(),
  });

  const picker = page.getByRole('dialog', { name: '打开方式', exact: true });
  const viewer = page.getByRole('dialog', { name, exact: true });
  const save = page.getByRole('button', { name: '保存文件应用', exact: true });
  const admin = () => openApplications(page);
  async function apply() {
    await save.click();
    await expect(page.getByRole('status').filter({ hasText: '文件应用设置已保存' })).toBeVisible();
  }
  async function selectTextDefault() {
    await page.getByRole('button', { name: /\.md 的默认应用/ }).click();
    await page.getByRole('option', { name: '文本编辑器', exact: true }).click();
  }
  async function openFile() {
    await page.goto(folder.pathname + folder.search);
    await page.getByRole('button', { name, exact: true }).click();
  }
  async function openWith() {
    await page.getByRole('button', { name: name + ' 的操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '打开方式', exact: true }).click();
  }
  const markdown = picker.getByRole('button', { name: 'Markdown 编辑器', exact: true });
  const text = picker.getByRole('button', { name: '文本编辑器', exact: true });
  const heading = viewer
    .getByRole('article', { name: '预览', exact: true })
    .getByRole('heading', { name: '内置文件应用', exact: true });

  try {
    await admin();
    const row = page
      .getByRole('row')
      .filter({ has: page.getByRole('rowheader', { name: 'Markdown 编辑器', exact: true }) });
    await expect(row).toContainText('.md, .markdown');
    await page.getByRole('button', { name: '恢复内置策略', exact: true }).click();
    await selectTextDefault();
    await filesAPI(page, '/applications', 'PUT', {
      revision: initial.revision,
      apps: [],
      defaults: initial.builtInDefaults,
    });
    await save.click();
    await expect(
      page.getByRole('alert').filter({ hasText: '其他管理员已保存新的文件应用设置' }),
    ).toBeVisible();
    await expect(save).toBeDisabled();
    await admin();
    await selectTextDefault();
    await apply();
    await openFile();
    await expect(viewer.getByLabel('文件内容', { exact: true })).toHaveText('# 内置文件应用');
    await viewer.getByRole('button', { name: '关闭', exact: true }).click();
    await openWith();
    await expect(text).toBeVisible();
    await expect(markdown).toBeVisible();
    await page.screenshot({ path: info.outputPath('applications-picker.png') });
    await markdown.click();
    await expect(heading).toBeVisible();

    await admin();
    await page.getByRole('button', { name: '移除 .md 的默认打开方式', exact: true }).click();
    await apply();
    await openFile();
    await expect(markdown).toBeVisible();
    await text.click();
    await expect(viewer.getByLabel('文件内容', { exact: true })).toHaveText('# 内置文件应用');

    await admin();
    await row.getByRole('button', { name: /平台/ }).click();
    await page.getByRole('option', { name: '桌面端', exact: true }).click();
    await page
      .getByRole('region', { name: '默认打开方式', exact: true })
      .getByRole('button', { name: /扩展名/ })
      .click();
    await page.getByRole('option', { name: '.md', exact: true }).click();
    await page.getByRole('button', { name: '添加默认规则', exact: true }).click();
    await apply();
    await page.getByRole('heading', { name: '默认打开方式', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('applications-admin.png') });
    await page.setViewportSize({ width: 390, height: 760 });
    await openFile();
    await expect(viewer.getByLabel('文件内容', { exact: true })).toHaveText('# 内置文件应用');
    await viewer.getByRole('button', { name: '关闭', exact: true }).click();
    await openWith();
    await expect(text).toBeVisible();
    await expect(markdown).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 900 });
    await admin();
    const enableText = page.getByRole('checkbox', { name: '启用 文本编辑器', exact: true });
    await enableText.press('Space');
    await expect(enableText).not.toBeChecked();
    await apply();
    await page.setViewportSize({ width: 390, height: 760 });
    await openFile();
    await expect(picker.getByRole('status')).toContainText('没有可用的浏览应用');
    const download = page.waitForEvent('download');
    await picker.getByRole('button', { name: '下载', exact: true }).click();
    expect((await download).suggestedFilename()).toBe(name);
    await page.setViewportSize({ width: 1280, height: 900 });
    await admin();
    await page.getByRole('button', { name: '恢复内置策略', exact: true }).click();
    await apply();
    await openFile();
    await expect(heading).toBeVisible();
  } finally {
    await restoreApplications(page, initial);
  }
});

test('扩展名关联编辑、别名打开和清空恢复', async ({ page }, info) => {
  await loginQA(page);
  const initial = await filesAPI<FileApplicationView>(page, '/applications');
  await openReadingFixtureFolder(page, '关联验收-');
  const folder = new URL(page.url());
  const parentId = folder.searchParams.get('parent')!;
  const alias = '会议记录.NOTE168';
  const broken = '损坏.BOOK168';
  await filesAPI(page, '/text', 'POST', {
    parentId,
    name: alias,
    text: '# 已存在的别名文件',
    key: randomUUID(),
  });
  await filesAPI(page, '/text', 'POST', {
    parentId,
    name: broken,
    text: 'invalid EPUB archive',
    key: randomUUID(),
  });

  const row = (name: string) =>
    page.getByRole('row').filter({
      has: page.getByRole('rowheader', { name, exact: true }),
    });
  const markdownRow = row('Markdown 编辑器');
  const textRow = row('文本编辑器');
  const epubRow = row('EPUB 阅读器');
  const editor = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('textbox', { name: '扩展名', exact: true }) });
  const list = editor.getByRole('textbox', { name: '扩展名', exact: true });
  const apply = editor.getByRole('button', { name: '应用到草稿', exact: true });
  const save = page.getByRole('button', { name: '保存文件应用', exact: true });
  const defaults = page.getByRole('region', { name: '默认打开方式', exact: true });
  const viewer = page.getByRole('dialog', { name: alias, exact: true });
  async function edit(target: ReturnType<typeof row>, value: string) {
    await target.getByRole('button', { name: '编辑扩展名', exact: true }).click();
    await list.fill(value);
  }
  async function savePolicy() {
    await save.click();
    await expect(page.getByRole('status').filter({ hasText: '文件应用设置已保存' })).toBeVisible();
  }
  async function open(name: string) {
    await page.goto(folder.pathname + folder.search);
    await page.getByRole('button', { name, exact: true }).click();
  }

  try {
    await openApplications(page);
    await page.getByRole('button', { name: '恢复内置策略', exact: true }).click();
    await expect(markdownRow).toContainText('内置关联');
    await edit(markdownRow, 'bad/name');
    await expect(editor.getByText('请检查扩展名格式。', { exact: true })).toBeVisible();
    await expect(apply).toBeDisabled();
    await list.fill('.NOTE168, note168');
    await expect(editor.getByText('同一应用的扩展名不能重复。', { exact: true })).toBeVisible();
    await list.fill(Array.from({ length: 49 }, (_, index) => 'x' + index).join(', '));
    await expect(editor.getByText('扩展名数量超出限制。', { exact: true })).toBeVisible();
    await list.fill('note168');
    await editor.getByRole('button', { name: '取消', exact: true }).click();
    await expect(markdownRow).not.toContainText('.note168');

    await edit(markdownRow, ' .MD, .NOTE168 ');
    await page.screenshot({ path: info.outputPath('extensions-edit.png'), animations: 'disabled' });
    await apply.click();
    await expect(markdownRow).toContainText('.md, .note168');
    await expect(markdownRow).toContainText('自定义关联');
    await expect(
      defaults.getByRole('button', { name: '移除 .markdown 的默认打开方式', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: '已从草稿移除' })).toBeVisible();
    await edit(textRow, 'txt md markdown note168');
    await apply.click();
    await edit(epubRow, 'epub book168');
    await apply.click();
    await markdownRow.getByRole('button', { name: /平台/ }).click();
    await page.getByRole('option', { name: '桌面端', exact: true }).click();
    await defaults.getByRole('button', { name: /扩展名/ }).click();
    await page.getByRole('option', { name: '.note168', exact: true }).click();
    await defaults.getByRole('button', { name: '添加默认规则', exact: true }).click();
    await savePolicy();
    await expect(
      defaults.getByRole('button', { name: /Markdown 编辑器 .*\.note168 的默认应用/ }),
    ).toBeVisible();

    await open(alias);
    const preview = viewer.getByRole('article', { name: '预览', exact: true });
    await expect(
      preview.getByRole('heading', { name: '已存在的别名文件', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath('extensions-preview.png'),
      animations: 'disabled',
    });
    await viewer.getByRole('button', { name: '源码', exact: true }).click();
    await viewer.getByLabel('文件内容', { exact: true }).fill('# 别名编辑已保存');
    await viewer.getByRole('button', { name: '保存', exact: true }).click();
    await expect(viewer).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 760 });
    await open(alias);
    await expect(viewer.getByLabel('文件内容', { exact: true })).toHaveText('# 别名编辑已保存');
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(broken);
    const damaged = page.getByRole('dialog', { name: broken, exact: true });
    await expect(damaged.getByRole('alert')).toContainText('无法读取此 EPUB');
    await expect(damaged.getByRole('button', { name: '下载', exact: true })).toBeEnabled();

    await openApplications(page);
    await expect(markdownRow).toContainText('.note168');
    await edit(markdownRow, '');
    await apply.click();
    await expect(markdownRow).toContainText('无关联扩展名');
    await expect(
      defaults.getByRole('button', { name: '移除 .note168 的默认打开方式', exact: true }),
    ).toHaveCount(0);
    await savePolicy();
    await open(alias);
    await expect(viewer.getByLabel('文件内容', { exact: true })).toHaveText('# 别名编辑已保存');
    await openApplications(page);
    await markdownRow.getByRole('button', { name: '恢复内置扩展名', exact: true }).click();
    await expect(markdownRow).toContainText('.md, .markdown');
    await expect(markdownRow).toContainText('内置关联');
    await expect(markdownRow).toContainText('桌面端');
    await savePolicy();
  } finally {
    await restoreApplications(page, initial);
  }
});

test('新建文件映射按配置创建真实文件并保留后缀', async ({ page }, info) => {
  await loginQA(page);
  const initial = await filesAPI<FileApplicationView>(page, '/applications');
  const folderName = '000169-' + randomUUID().slice(0, 8);
  const folder = await filesAPI<{ id: string }>(page, '/folders', 'POST', {
    parentId: '',
    name: folderName,
  });
  const row = page.getByRole('row').filter({
    has: page.getByRole('rowheader', { name: 'Markdown 编辑器', exact: true }),
  });
  const edit = row.getByRole('button', { name: '编辑映射', exact: true });
  const editor = page.getByRole('dialog', { name: 'Markdown 编辑器的新建文件映射', exact: true });
  const apply = editor.getByRole('button', { name: '应用到草稿', exact: true });
  const add = editor.getByRole('button', { name: '添加映射', exact: true });
  const label = (extension: string) =>
    editor
      .getByRole('group', { name: extension, exact: true })
      .getByLabel('菜单名称', { exact: true });
  const save = page.getByRole('button', { name: '保存文件应用', exact: true });
  const newMenu = page.getByRole('button', { name: '新建', exact: true });
  const creation = page.getByRole('menuitem', { name: '会议纪要 (.markdown)', exact: true });
  const draft = page.getByRole('menuitem', { name: '草稿 (.md)', exact: true });
  const defaultText = page.getByRole('menuitem', { name: '新建文本', exact: true });
  const fileName = '周会.MARKDOWN';
  async function savePolicy() {
    await save.click();
    await expect(page.getByRole('status').filter({ hasText: '文件应用设置已保存' })).toBeVisible();
  }
  async function openMenu(path = '/home') {
    await page.goto(path);
    await newMenu.click();
    await expect(defaultText).toBeVisible();
  }

  try {
    await openApplications(page);
    await page.getByRole('button', { name: '恢复内置策略', exact: true }).click();
    await expect(row.getByRole('cell', { name: /1/ })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'EPUB 阅读器' })).toContainText('不适用');
    await edit.click();
    await expect(label('.md')).toHaveValue('Markdown');
    await label('.md').fill('取消的修改');
    await editor.getByRole('button', { name: '取消', exact: true }).click();
    await edit.click();
    await expect(label('.md')).toHaveValue('Markdown');
    await label('.md').fill('草稿');
    await add.click();
    await expect(apply).toBeDisabled();
    await expect(add).toBeDisabled();
    await label('.markdown').fill(' 会议纪要 ');
    await editor
      .getByRole('group', { name: '.markdown', exact: true })
      .getByRole('button', { name: '上移', exact: true })
      .click();
    await expect(editor.locator('legend')).toHaveText(['.markdown', '.md']);
    await page.screenshot({
      path: info.outputPath('creation-mappings.png'),
      animations: 'disabled',
    });
    await apply.click();
    await row.getByRole('button', { name: /平台/ }).click();
    await page.getByRole('option', { name: '桌面端', exact: true }).click();
    await savePolicy();

    await page.goto('/home?parent=' + folder.id);
    await page.getByRole('link', { name: '我的分享', exact: true }).click();
    await newMenu.click();
    await expect(creation).toBeVisible();
    await expect(draft).toBeVisible();
    const entries = await page.getByRole('menuitem').allTextContents();
    expect(entries.findIndex((entry) => entry.includes('会议纪要'))).toBeLessThan(
      entries.findIndex((entry) => entry.includes('草稿')),
    );
    await page.screenshot({ path: info.outputPath('creation-menu.png'), animations: 'disabled' });
    await creation.click();
    const picker = page.getByRole('dialog');
    await picker.getByRole('button', { name: '进入 ' + folderName, exact: true }).click();
    await picker.getByRole('button', { name: '使用此位置', exact: true }).click();
    const create = page.getByRole('dialog', { name: '会议纪要 (.markdown)', exact: true });
    await create.getByLabel('名称', { exact: true }).fill(fileName);
    await create.getByLabel('文件内容', { exact: true }).fill('# 周会正文');
    await create.getByRole('button', { name: '保存', exact: true }).click();
    await expect(create).toHaveCount(0);
    await page.goto('/home?parent=' + folder.id);
    await page.getByRole('button', { name: fileName, exact: true }).click();
    await expect(page.getByRole('heading', { name: '周会正文', exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 760 });
    await openMenu();
    await expect(creation).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openApplications(page);
    await row.getByRole('checkbox', { name: '启用 Markdown 编辑器', exact: true }).press('Space');
    await savePolicy();
    await openMenu();
    await expect(creation).toHaveCount(0);
    await openApplications(page);
    await row.getByRole('checkbox', { name: '启用 Markdown 编辑器', exact: true }).press('Space');
    await edit.click();
    await editor.getByRole('button', { name: '移除映射', exact: true }).first().click();
    await editor.getByRole('button', { name: '移除映射', exact: true }).click();
    await expect(editor.getByText('暂无新建文件映射。', { exact: true })).toBeVisible();
    await apply.click();
    await savePolicy();
    await openMenu();
    await expect(creation).toHaveCount(0);
    await expect(draft).toHaveCount(0);
    await openApplications(page);
    await row.getByRole('button', { name: '恢复内置映射', exact: true }).click();
    await savePolicy();
    await openMenu();
    await expect(page.getByRole('menuitem', { name: '新建 Markdown', exact: true })).toBeVisible();
  } finally {
    await restoreApplications(page, initial);
  }
});

test('网页应用配置和临时文件预览', async ({ page }, info) => {
  await loginQA(page);
  const initial = await filesAPI<FileApplicationView>(page, '/applications');
  const publication = await preparePublicationFixture(page);
  await openReadingFixtureFolder(page, '网页验收-');
  const folder = new URL(page.url());
  const name = '外部阅读 中文.MD';
  await filesAPI(page, '/text', 'POST', {
    parentId: folder.searchParams.get('parent')!,
    name,
    text: 'web-preview-fixture',
    key: randomUUID(),
  });
  const viewerName = '文档网页阅读器';
  const origin = 'https://viewer.example.test';
  const add = page.getByRole('button', { name: '添加网页应用', exact: true });
  const draft = page.getByRole('button', { name: '应用到草稿', exact: true });
  const edit = page.getByRole('button', { name: '编辑 ' + viewerName, exact: true });
  const save = page.getByRole('button', { name: '保存文件应用', exact: true });
  const settings = () => page.getByRole('dialog', { name: /^(添加|编辑)网页应用$/ });
  const viewer = page.getByRole('dialog', { name: viewerName, exact: true });
  const allow = viewer.getByRole('button', { name: '允许并继续', exact: true });
  const currentFile = page.getByRole('button', { name, exact: true });
  let requests = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/web-preview'))
      requests++;
  });
  await page.context().route(origin + '/read?*', async (route) => {
    const url = new URL(route.request().url());
    const source = new URL(url.searchParams.get('file')!);
    expect(source.origin).toBe(publication.origin);
    expect(source.pathname).toMatch(/^\/api\/v1\/file-web-previews\/[A-Za-z0-9_-]+$/);
    expect(url.searchParams.get('name')).toBe(name);
    const response = await page.request.get(source.href, { headers: { Origin: origin } });
    expect(response.ok()).toBe(true);
    expect(response.headers()['access-control-allow-origin']).toBe(origin);
    expect(await response.text()).toBe('web-preview-fixture');
    await route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<h1>阅读器收到文件正文</h1>',
    });
  });
  async function savePolicy() {
    await save.click();
    await expect(page.getByRole('status').filter({ hasText: '文件应用设置已保存' })).toBeVisible();
  }
  async function goFile() {
    await page.goto(folder.pathname + folder.search);
    await currentFile.click();
  }
  try {
    await publication.activate();
    await openApplications(page);
    await add.click();
    await expect(draft).toBeDisabled();
    await settings().getByLabel('名称', { exact: true }).fill('未保存');
    await settings().getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.getByText('未保存', { exact: true })).toHaveCount(0);
    await add.click();
    await settings().getByLabel('名称', { exact: true }).fill(viewerName);
    const icon = settings().getByLabel('图标地址', { exact: true });
    await icon.fill('http://viewer.example.test/icon.png');
    await expect(settings().getByText('请输入受支持的 HTTPS 图片地址。')).toBeVisible();
    await icon.fill('');
    const extensions = settings().getByLabel('扩展名列表', { exact: true });
    await extensions.fill('md, .MD');
    await expect(settings().getByText('请检查扩展名格式或重复项。')).toBeVisible();
    await extensions.fill('.MD');
    const address = settings().getByLabel('应用 URL', { exact: true });
    await address.fill('http://viewer.example.test/read?file={$src}');
    await expect(settings().getByText('请输入含文件地址变量的 HTTPS 模板。')).toBeVisible();
    await address.fill(origin + '/read?file={$src}&name={$name}');
    await settings().getByLabel('最大文件大小（字节）', { exact: true }).fill('512');
    await settings().getByRole('button', { name: /平台/ }).click();
    await page.getByRole('option', { name: '桌面端', exact: true }).click();
    await page.screenshot({ path: info.outputPath('web-app-form.png'), animations: 'disabled' });
    await draft.click();
    const defaults = page.getByRole('region', { name: '默认打开方式', exact: true });
    await defaults.getByRole('button', { name: /\.md 的默认应用/ }).click();
    await page.getByRole('option', { name: viewerName, exact: true }).click();
    await savePolicy();

    await goFile();
    await expect(viewer).toContainText(origin);
    await expect(viewer).toContainText('五分钟');
    await expect(page.locator('iframe[title="' + viewerName + '"]')).toHaveCount(0);
    await viewer.getByRole('button', { name: '关闭', exact: true }).click();
    expect(requests).toBe(0);
    await currentFile.click();
    await allow.click();
    await expect(
      page
        .frameLocator('iframe[title="' + viewerName + '"]')
        .getByRole('heading', { name: '阅读器收到文件正文' }),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath('web-app-preview.png'), animations: 'disabled' });
    expect(requests).toBe(1);
    await page.setViewportSize({ width: 390, height: 760 });
    await goFile();
    const choices = page.getByRole('dialog', { name: '打开方式', exact: true });
    await expect(
      choices.getByRole('button', { name: 'Markdown 编辑器', exact: true }),
    ).toBeVisible();
    await expect(choices.getByRole('button', { name: viewerName, exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openApplications(page);
    await edit.click();
    await settings().getByRole('checkbox', { name: '在新标签页打开', exact: true }).press('Space');
    await draft.click();
    await savePolicy();
    await goFile();
    await allow.click();
    const link = viewer.getByRole('link', { name: '在新标签页打开', exact: true });
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(page.locator('iframe[title="' + viewerName + '"]')).toHaveCount(0);
    const popupPromise = page.waitForEvent('popup');
    await link.click();
    const popup = await popupPromise;
    await expect(popup.getByRole('heading', { name: '阅读器收到文件正文' })).toBeVisible();
    await popup.close();

    await openApplications(page);
    await page.getByRole('checkbox', { name: '启用 ' + viewerName, exact: true }).press('Space');
    await savePolicy();
    await goFile();
    await expect(choices.getByRole('button', { name: viewerName, exact: true })).toHaveCount(0);
    await openApplications(page);
    await page.getByRole('button', { name: '移除 ' + viewerName, exact: true }).click();
    await savePolicy();
    await expect(edit).toHaveCount(0);
  } finally {
    try {
      await restoreApplications(page, initial);
    } finally {
      await publication.restore();
    }
  }
});

test('导入 WOPI 应用并打开真实只读文件', async ({ page }, info) => {
  await loginQA(page);
  const initial = await filesAPI<FileApplicationView>(page, '/applications');
  const publication = await preparePublicationFixture(page);
  await openReadingFixtureFolder(page, 'WOPI验收-');
  const folder = new URL(page.url());
  const name = 'WOPI 预览样例.MD';
  await filesAPI(page, '/text', 'POST', {
    parentId: folder.searchParams.get('parent')!,
    name,
    text: 'wopi-view-browser-fixture',
    key: randomUUID(),
  });
  const origin = 'https://wopi.example.test';
  const endpoint = origin + '/hosting/discovery';
  const appName = 'WOPI 文档预览';
  let discoveryRequests = 0;
  let viewerRequests = 0;
  await page.route('**/applications/wopi-discovery', async (route) => {
    discoveryRequests++;
    const request = route.request().postDataJSON() as { endpoint: string };
    if (request.endpoint !== endpoint) {
      await route.fulfill({ status: 503, json: { error: { code: 'files_offline_unavailable' } } });
      return;
    }
    await route.fulfill({
      json: {
        origin,
        discoveryUrl: endpoint,
        actions: [
          { extension: 'docx', url: origin + '/document' },
          { extension: 'xlsx', url: origin + '/sheet' },
          { extension: 'md', url: origin + '/reader', editUrl: origin + '/edit' },
        ],
      },
    });
  });
  await page.context().route(origin + '/reader?*', async (route) => {
    viewerRequests++;
    const request = route.request();
    expect(request.method()).toBe('POST');
    expect(request.headers()['referer']).toBeUndefined();
    const action = new URL(request.url());
    const source = new URL(action.searchParams.get('WOPISrc')!);
    expect(source.origin).toBe(publication.origin);
    expect(source.pathname).toMatch(/^\/wopi\/files\/[a-f0-9-]{36}$/);
    expect(source.search).toBe('');
    expect(action.searchParams.has('access_token')).toBe(false);
    const form = new URLSearchParams(request.postData()!);
    const token = form.get('access_token')!;
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Number(form.get('access_token_ttl'))).toBeGreaterThan(Date.now() + 240_000);
    const query = '?' + new URLSearchParams({ access_token: token }).toString();
    const metadata = await page.request.get(source.href + query);
    expect(metadata.status()).toBe(200);
    expect(await metadata.json()).toMatchObject({
      BaseFileName: name,
      UserCanWrite: false,
      ReadOnly: true,
    });
    const bytes = await page.request.get(source.href + '/contents' + query);
    expect(bytes.status()).toBe(200);
    expect(bytes.headers()['x-wopi-itemversion']).toBe('1');
    expect(await bytes.text()).toBe('wopi-view-browser-fixture');
    await route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<h1>WOPI 只读文档已加载</h1>',
    });
  });
  await page.context().route(origin + '/edit?*', async (route) => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    const form = new URLSearchParams(request.postData()!);
    const source = new URL(request.url()).searchParams.get('WOPISrc')!;
    expect(new URL(source).origin).toBe(publication.origin);
    const query = '?' + new URLSearchParams({ access_token: form.get('access_token')! }).toString();
    const metadata = await page.request.get(source + query);
    expect(await metadata.json()).toMatchObject({
      BaseFileName: name,
      UserCanWrite: true,
      ReadOnly: false,
    });
    const headers = { 'X-WOPI-Lock': 'qa-edit-lock' };
    const lock = await page.request.post(source + query, {
      headers: { ...headers, 'X-WOPI-Override': 'LOCK' },
    });
    expect(lock.status()).toBe(200);
    const saved = await page.request.post(source + '/contents' + query, {
      headers: { ...headers, 'X-WOPI-Override': 'PUT', 'Content-Type': 'application/octet-stream' },
      data: Buffer.from('edited from the WOPI reader'),
    });
    expect(saved.status()).toBe(200);
    expect(saved.headers()['x-wopi-itemversion']).toBe('2');
    const read = await page.request.get(source + '/contents' + query);
    expect(await read.text()).toBe('edited from the WOPI reader');
    const unlock = await page.request.post(source + query, {
      headers: { ...headers, 'X-WOPI-Override': 'UNLOCK' },
    });
    expect(unlock.status()).toBe(200);
    await route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<h1>WOPI 文档已保存</h1>',
    });
  });
  const open = page.getByRole('button', { name: '添加 WOPI 应用', exact: true });
  const importer = page.getByRole('dialog', { name: '导入 WOPI 应用设置', exact: true });
  const discover = importer.getByRole('button', { name: '检查发现地址', exact: true });
  const address = importer.getByLabel('WOPI Discovery Endpoint', { exact: true });
  const draft = page.getByRole('button', { name: '应用到草稿', exact: true });
  const viewer = page.getByRole('dialog', { name: appName, exact: true });
  const allow = viewer.getByRole('button', { name: '允许并继续', exact: true });
  const file = page.getByRole('button', { name, exact: true });
  const save = page.getByRole('button', { name: '保存文件应用', exact: true });
  async function savePolicy() {
    await save.click();
    await expect(page.getByRole('status').filter({ hasText: '文件应用设置已保存' })).toBeVisible();
  }
  async function openFile() {
    await page.goto(folder.pathname + folder.search);
    await file.click();
  }
  try {
    await publication.activate();
    await openApplications(page);
    await open.click();
    await expect(discover).toBeDisabled();
    await address.fill('http://wopi.example.test/hosting/discovery');
    await expect(importer.getByText('请输入有效的 HTTPS 地址。')).toBeVisible();
    expect(discoveryRequests).toBe(0);
    await address.fill(origin + '/invalid');
    await discover.click();
    await expect(importer.getByRole('alert')).toContainText('无法导入 WOPI 应用');
    await address.fill(endpoint);
    await discover.click();
    await expect(importer.getByRole('status')).toContainText('发现 3 种可预览格式');
    await importer.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.getByText('WOPI · wopi.example.test', { exact: true })).toHaveCount(0);
    await open.click();
    await address.fill(endpoint);
    await discover.click();
    await expect(importer.getByRole('status')).toContainText('.docx, .xlsx, .md');
    await expect(importer.getByRole('status')).toContainText('可编辑格式 .md');
    await page.screenshot({ path: info.outputPath('wopi-discovery.png'), animations: 'disabled' });
    await draft.click();
    await page.getByRole('button', { name: '编辑 WOPI · wopi.example.test', exact: true }).click();
    const edit = page.getByRole('dialog', { name: '编辑 WOPI 应用', exact: true });
    await edit.getByLabel('名称', { exact: true }).fill(appName);
    await edit.getByLabel('扩展名列表', { exact: true }).fill('md, pdf');
    await expect(edit.getByText('请选择发现结果中支持的扩展名。')).toBeVisible();
    await edit.getByLabel('扩展名列表', { exact: true }).fill('md, docx');
    await edit.getByRole('checkbox', { name: '允许在线编辑', exact: true }).press('Space');
    await edit.getByRole('button', { name: /平台/ }).click();
    await page.getByRole('option', { name: '桌面端', exact: true }).click();
    await draft.click();
    const defaults = page.getByRole('region', { name: '默认打开方式', exact: true });
    await defaults.getByRole('button', { name: /\.md 的默认应用/ }).click();
    await page.getByRole('option', { name: appName, exact: true }).click();
    await savePolicy();

    await openFile();
    await expect(viewer).toContainText(origin);
    expect(viewerRequests).toBe(0);
    await allow.click();
    await expect(
      page
        .frameLocator('iframe[title="' + appName + '"]')
        .getByRole('heading', { name: 'WOPI 只读文档已加载' }),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath('wopi-reader.png'), animations: 'disabled' });
    expect(viewerRequests).toBe(1);
    const newTab = viewer.getByRole('button', { name: '在新标签页打开', exact: true });
    await expect(newTab).toBeInViewport();
    const popupPromise = page.waitForEvent('popup');
    await newTab.click();
    const popup = await popupPromise;
    await expect(popup.getByRole('heading', { name: 'WOPI 只读文档已加载' })).toBeVisible();
    await popup.close();
    expect(viewerRequests).toBe(2);
    await openFile();
    await expect(viewer.getByRole('button', { name: '允许编辑', exact: true })).toBeEnabled();
    await page.screenshot({
      path: info.outputPath('wopi-edit-consent.png'),
      animations: 'disabled',
    });
    await viewer.getByRole('button', { name: '允许编辑', exact: true }).click();
    await expect(
      page
        .frameLocator('iframe[title="' + appName + '"]')
        .getByRole('heading', { name: 'WOPI 文档已保存' }),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath('wopi-editor.png'), animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 760 });
    await openFile();
    const choices = page.getByRole('dialog', { name: '打开方式', exact: true });
    await expect(
      choices.getByRole('button', { name: 'Markdown 编辑器', exact: true }),
    ).toBeVisible();
    await expect(choices.getByRole('button', { name: appName, exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openApplications(page);
    await page.getByRole('checkbox', { name: '启用 ' + appName, exact: true }).press('Space');
    await savePolicy();
    await openFile();
    await expect(choices.getByRole('button', { name: appName, exact: true })).toHaveCount(0);
    await openApplications(page);
    await page.getByRole('button', { name: '移除 ' + appName, exact: true }).click();
    await savePolicy();
    await expect(page.getByText(appName, { exact: true })).toHaveCount(0);
  } finally {
    try {
      await restoreApplications(page, initial);
    } finally {
      await publication.restore();
    }
  }
});
