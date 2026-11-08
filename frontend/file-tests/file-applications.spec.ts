import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { FileApplicationView } from '../surfaces/src/files/file-applications';
import { openReadingFixtureFolder } from './reading-fixture';

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

async function restoreApplications(page: Page, initial: FileApplicationView) {
  const current = await filesAPI<FileApplicationView>(page, '/applications');
  await filesAPI(page, '/applications', 'PUT', {
    revision: current.revision,
    apps: initial.items.map(({ id, enabled, platform, customExtensions, extensions }) => ({
      id,
      enabled,
      platform,
      ...(customExtensions ? { extensions } : {}),
    })),
    defaults: initial.defaults,
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
    await page.getByRole('option', { name: '文本查看器', exact: true }).click();
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
  const text = picker.getByRole('button', { name: '文本查看器', exact: true });
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
    await expect(viewer.locator('pre')).toHaveText('# 内置文件应用');
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
    await expect(viewer.locator('pre')).toHaveText('# 内置文件应用');

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
    await expect(viewer.locator('pre')).toHaveText('# 内置文件应用');
    await viewer.getByRole('button', { name: '关闭', exact: true }).click();
    await openWith();
    await expect(text).toBeVisible();
    await expect(markdown).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 900 });
    await admin();
    const enableText = page.getByRole('checkbox', { name: '启用 文本查看器', exact: true });
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
  const textRow = row('文本查看器');
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
    await expect(viewer.locator('pre')).toHaveText('# 别名编辑已保存');
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
    await expect(viewer.locator('pre')).toHaveText('# 别名编辑已保存');
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
