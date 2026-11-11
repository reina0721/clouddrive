import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

test.use({ actionTimeout: 15_000 });
const color = '#4589ab';
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
  const response = await page.evaluate(
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
  expect(response.status, method + ' ' + path).toBe(200);
  return response.value;
}
async function fixture(page: Page) {
  const suffix = randomUUID().slice(0, 8),
    name = '整理-' + suffix,
    root = await api(page, '/folders', 'POST', { name, parentId: '' });
  const file = await api(page, '/text', 'POST', {
    name: 'sample-' + suffix + '.txt',
    parentId: root.id,
    text: 'hello',
    key: randomUUID(),
  });
  return { suffix, name, root, file };
}
async function action(page: Page, name: string, label: string) {
  await page.getByRole('button', { name: name + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
  await expect(page.getByRole('dialog', { name: name + ' 的操作', exact: true })).toHaveCount(0);
}
async function properties(page: Page, name: string) {
  await action(page, name, '属性');
  await expect(
    page.getByRole('dialog').getByRole('button', { name: '编辑整理信息', exact: true }),
  ).toBeVisible();
  return page.getByRole('dialog');
}
async function close(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('整理信息已保存', { exact: true })).toBeVisible();
}
const row = (page: Page, id: unknown) => page.locator('[data-file-item="' + String(id) + '"]');
async function narrow(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
}
async function writeAnnotations(
  page: Page,
  id: unknown,
  tags: { name: string; color: string }[],
  properties: { key: string; value: string }[] = [],
  emoji = '',
) {
  return api(page, '/' + String(id) + '/annotations', 'PUT', {
    expectedRevision: 0,
    tags,
    properties,
    emoji,
    folderColor: '',
  });
}

test('属性侧栏、标签编辑、颜色、空属性、个性化与真实复制位置', async ({ page, context }, info) => {
  test.setTimeout(180_000);
  await login(page);
  const value = await fixture(page);
  await api(page, '/folders', 'POST', { name: '后代', parentId: value.root.id });
  await page.goto('/home?search=' + encodeURIComponent(value.name));
  let panel = await properties(page, value.name);
  const stats = panel.getByRole('region', { name: '有效内容统计', exact: true });
  await expect(
    stats.getByText('文件', { exact: true }).locator('..').getByText('1', { exact: true }),
  ).toBeVisible();
  await expect(
    stats.getByText('逻辑大小', { exact: true }).locator('..').getByText('5 B', { exact: true }),
  ).toBeVisible();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(page.url()).origin,
  });
  await panel.getByRole('button', { name: '复制完整位置', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('/' + value.name);
  await panel.getByRole('button', { name: '编辑整理信息', exact: true }).click();
  await panel.getByRole('button', { name: '添加标签', exact: true }).click();
  await panel.getByLabel('标签 1 名称', { exact: true }).fill('工作,甲-' + value.suffix);
  await panel.getByLabel('标签 1 颜色', { exact: true }).fill(color);
  await panel.getByRole('button', { name: '添加属性', exact: true }).click();
  await panel.getByLabel('属性 1 键', { exact: true }).fill('sys:shared_redirect');
  await panel.getByLabel('属性 1 值', { exact: true }).fill('保留草稿');
  await panel.getByRole('button', { name: '保存', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('整理信息无效');
  await expect(panel.getByLabel('属性 1 值', { exact: true })).toHaveValue('保留草稿');
  await panel.getByLabel('属性 1 键', { exact: true }).fill('Project');
  await panel
    .getByLabel('属性 1 值', { exact: true })
    .fill('<script>window.annotationExecuted=true</script>');
  await panel.getByRole('button', { name: '添加属性', exact: true }).click();
  await panel.getByLabel('属性 2 键', { exact: true }).fill('Empty');
  await panel.getByLabel('Emoji 图标', { exact: true }).fill('📚');
  await panel.getByLabel('目录图标颜色', { exact: true }).fill(color);
  await save(page);
  await panel.getByRole('button', { name: '复制完整名称', exact: true }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(value.name);
  await page.screenshot({
    path: info.outputPath('annotation-drawer-desktop.png'),
    fullPage: false,
  });
  await narrow(page);
  await page.screenshot({ path: info.outputPath('annotation-drawer-mobile.png'), fullPage: false });
  await close(page);
  await expect(row(page, value.root.id)).toContainText('📚');
  await expect(
    row(page, value.root.id).getByRole('button', {
      name: '按标签 工作,甲-' + value.suffix + ' 查看全部自有文件',
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  panel = await properties(page, value.name);
  await panel.getByRole('button', { name: '编辑整理信息', exact: true }).click();
  await expect(panel.getByLabel('属性 2 值', { exact: true })).toHaveValue('');
  await expect(panel.getByLabel('属性 1 值', { exact: true })).toHaveValue(
    '<script>window.annotationExecuted=true</script>',
  );
  expect(await page.evaluate(() => Object.hasOwn(window, 'annotationExecuted'))).toBe(false);
  await panel.getByLabel('标签 1 名称', { exact: true }).fill('归档-' + value.suffix);
  await panel.getByLabel('Emoji 图标', { exact: true }).fill('');
  await save(page);
  await close(page);
  await expect(row(page, value.root.id).locator('svg[style]')).toHaveCSS(
    'color',
    'rgb(69, 137, 171)',
  );
  panel = await properties(page, value.name);
  await panel.getByRole('button', { name: '编辑整理信息', exact: true }).click();
  await panel.getByRole('button', { name: '恢复默认图标和颜色', exact: true }).click();
  await panel.getByRole('button', { name: '移除标签 归档-' + value.suffix, exact: true }).click();
  await panel.getByRole('button', { name: '移除属性 Project', exact: true }).click();
  await save(page);
  await close(page);
  await expect(row(page, value.root.id).getByRole('button', { name: /按标签/ })).toHaveCount(0);
  await expect(row(page, value.root.id).locator('svg[style]')).toHaveCount(0);
  const stored = await api(page, '/' + String(value.root.id) + '/annotations'),
    annotation = stored.annotation as {
      tags: unknown[];
      properties: { key: string; value: string }[];
      emoji: string;
      folderColor: string;
    };
  expect(annotation.tags).toEqual([]);
  expect(annotation.properties).toEqual([{ key: 'Empty', value: '' }]);
  expect(annotation.emoji).toBe('');
  expect(annotation.folderColor).toBe('');
});

test('批量标签冲突不部分写入，标签与属性组合检索可恢复', async ({ page }, info) => {
  test.setTimeout(180_000);
  await login(page);
  const value = await fixture(page),
    nameA = String(value.file.name),
    tagA = '工作-' + value.suffix,
    tagB = '项目,甲-' + value.suffix,
    shared = '共同-' + value.suffix;
  const second = await api(page, '/text', 'POST', {
    name: 'second-' + value.suffix + '.txt',
    parentId: value.root.id,
    text: '',
    key: randomUUID(),
  });
  await api(page, '/text', 'POST', {
    name: 'outside-' + value.suffix + '.txt',
    parentId: value.root.id,
    text: '',
    key: randomUUID(),
  });
  await writeAnnotations(
    page,
    value.file.id,
    [
      { name: tagA, color },
      { name: tagB, color },
    ],
    [
      { key: 'Empty', value: '' },
      { key: 'Project', value: 'AlphaBeta' },
    ],
  );
  await writeAnnotations(page, second.id, [{ name: tagA, color }]);
  await page.goto('/home?parent=' + String(value.root.id));
  const select = async () => {
    await page.getByRole('button', { name: nameA, exact: true }).click({ modifiers: ['Control'] });
    await page
      .getByRole('button', { name: String(second.name), exact: true })
      .click({ modifiers: ['Control'] });
  };
  await select();
  await page.getByRole('button', { name: '批量添加标签', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '添加标签', exact: true }).click();
  await dialog.getByLabel('标签 1 名称', { exact: true }).fill(shared);
  await api(page, '/' + String(second.id) + '/annotations', 'PUT', {
    expectedRevision: 1,
    tags: [
      { name: tagA, color },
      { name: '并发-' + value.suffix, color },
    ],
    properties: [],
    emoji: '',
    folderColor: '',
  });
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('其他窗口');
  await expect(dialog.getByLabel('标签 1 名称', { exact: true })).toHaveValue(shared);
  let annotation = (await api(page, '/' + String(value.file.id) + '/annotations')).annotation as {
    tags: { name: string }[];
  };
  expect(annotation.tags.some((tag) => tag.name === shared)).toBe(false);
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole('toolbar', { name: value.name, exact: true })
    .getByRole('button', { name: '刷新', exact: true })
    .click();
  await expect(page.getByText('已选择 2 项', { exact: true })).toHaveCount(0);
  await select();
  await page.getByRole('button', { name: '批量添加标签', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '添加标签', exact: true }).click();
  await dialog.getByLabel('标签 1 名称', { exact: true }).fill(shared);
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    row(page, value.file.id).getByRole('button', {
      name: '按标签 ' + shared + ' 查看全部自有文件',
      exact: true,
    }),
  ).toBeVisible();
  annotation = (await api(page, '/' + String(second.id) + '/annotations')).annotation as {
    tags: { name: string }[];
  };
  expect(annotation.tags.some((tag) => tag.name === '并发-' + value.suffix)).toBe(true);
  await select();
  await page.getByRole('button', { name: '批量移除标签', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('标签名称', { exact: true }).fill(shared);
  await dialog.getByLabel('标签名称', { exact: true }).press('Enter');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: '高级搜索', exact: true }).click();
  dialog = page.getByRole('dialog');
  for (const name of [tagA, tagB]) {
    await dialog.getByLabel('标签名称', { exact: true }).fill(name);
    await dialog.getByLabel('标签名称', { exact: true }).press('Enter');
  }
  await dialog.getByRole('checkbox', { name: '按自定义属性筛选', exact: true }).press('Space');
  await dialog.getByLabel('属性键', { exact: true }).fill('Empty');
  await dialog.getByRole('button', { name: /匹配方式/ }).click();
  await page.getByRole('option', { name: '值完全相等', exact: true }).click();
  await dialog.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-file-item]')).toHaveCount(1);
  const address = page.url();
  await page.reload();
  await expect(page).toHaveURL(address);
  await expect(page.locator('[data-file-item]')).toHaveCount(1);
  await page.getByRole('button', { name: /移除 自定义属性: Empty/ }).click();
  await page.getByRole('button', { name: '高级搜索', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: '需包含全部标签', exact: true }).press('Space');
  await dialog.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-file-item]')).toHaveCount(2);
  await page.screenshot({ path: info.outputPath('annotation-search-desktop.png'), fullPage: true });
  await narrow(page);
  await page.screenshot({ path: info.outputPath('annotation-search-mobile.png'), fullPage: true });
  await row(page, value.file.id)
    .getByRole('button', { name: '按标签 ' + tagA + ' 查看全部自有文件', exact: true })
    .click();
  await expect(page).not.toHaveURL(/parent=/);
  await expect(page.locator('[data-file-item]')).toHaveCount(2);
});

test('副本与回收保留整理信息，画廊按本屏加载且可批量整理', async ({ page }, info) => {
  test.setTimeout(180_000);
  await login(page);
  const value = await fixture(page),
    tag = '保留-' + value.suffix,
    copyName = '副本-' + value.suffix;
  await api(page, '/' + String(value.root.id) + '/annotations', 'PUT', {
    expectedRevision: 0,
    tags: [{ name: tag, color }],
    properties: [{ key: 'Keep', value: 'original' }],
    emoji: '📚',
    folderColor: color,
  });
  const lookup = '/home?search=' + encodeURIComponent(value.suffix);
  await page.goto(lookup);
  await action(page, value.name, '复制');
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('名称', { exact: true }).fill(copyName);
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: copyName, exact: true })).toBeVisible();
  let panel = await properties(page, copyName);
  await panel.getByRole('button', { name: '编辑整理信息', exact: true }).click();
  await expect(panel.getByLabel('属性 1 值', { exact: true })).toHaveValue('original');
  await panel.getByLabel('标签 1 名称', { exact: true }).fill('副本标签-' + value.suffix);
  await save(page);
  await close(page);
  expect(
    (
      (await api(page, '/' + String(value.root.id) + '/annotations')).annotation as {
        tags: { name: string }[];
      }
    ).tags[0]?.name,
  ).toBe(tag);
  await action(page, value.name, '移入回收站');
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(lookup + '&trash=true');
  await expect(row(page, value.root.id)).toContainText('📚');
  await action(page, value.name, '恢复');
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto('/home?parent=' + String(value.root.id));
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext('2d');
    if (!context) throw Error('No canvas');
    context.fillRect(0, 0, 16, 16);
    return canvas.toDataURL('image/png').split(',')[1]!;
  });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: 'photo-' + value.suffix + '.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.getByRole('dialog', { name: '上传队列', exact: true })).toBeVisible();
  await expect(page.getByText('上传完成', { exact: true })).toHaveCount(1);
  await page
    .getByRole('dialog', { name: '上传队列', exact: true })
    .getByRole('button', { name: '关闭', exact: true })
    .click();
  const listing = await api(page, '?parent=' + String(value.root.id)),
    image = (listing.items as { id: string; name: string }[]).find(
      (item) => item.name === 'photo-' + value.suffix + '.png',
    );
  if (!image) throw Error('Missing real uploaded image');
  await writeAnnotations(page, image.id, [{ name: tag, color }], [], '📷');
  await page.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('menuitem', { name: '画廊', exact: true }).click();
  await expect(
    row(page, image.id).getByRole('button', {
      name: '按标签 ' + tag + ' 查看全部自有文件',
      exact: true,
    }),
  ).toBeVisible();
  await expect(row(page, image.id)).toContainText('📷');
  await expect(row(page, image.id).locator('img')).toHaveCount(0);
  await page
    .getByRole('button', { name: image.name, exact: true })
    .click({ modifiers: ['Control'] });
  await page.getByRole('button', { name: '批量添加标签', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '添加标签', exact: true }).click();
  await dialog.getByLabel('标签 1 名称', { exact: true }).fill('画廊-' + value.suffix);
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    row(page, image.id).getByRole('button', {
      name: '按标签 画廊-' + value.suffix + ' 查看全部自有文件',
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('annotation-gallery-desktop.png'),
    fullPage: true,
  });
  await narrow(page);
  await page.screenshot({ path: info.outputPath('annotation-gallery-mobile.png'), fullPage: true });
  await page.route('**/native/files/annotations/summaries**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: '{"title":"temporary annotation outage"}',
    }),
  );
  await page
    .getByRole('toolbar', { name: value.name, exact: true })
    .getByRole('button', { name: '刷新', exact: true })
    .click();
  await expect(page.getByText('服务暂时不可用，请重试。', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: image.name, exact: true })
    .click({ modifiers: ['Control'] });
  await expect(page.getByRole('button', { name: '批量添加标签', exact: true })).toBeDisabled();
  await page.unroute('**/native/files/annotations/summaries**');
  await page
    .getByRole('toolbar', { name: value.name, exact: true })
    .getByRole('button', { name: '刷新', exact: true })
    .click();
  await expect(
    row(page, image.id).getByRole('button', {
      name: '按标签 画廊-' + value.suffix + ' 查看全部自有文件',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText('服务暂时不可用，请重试。', { exact: true })).toHaveCount(0);
  panel = await properties(page, image.name);
  await panel.getByRole('button', { name: '编辑整理信息', exact: true }).click();
  await expect(panel.getByLabel('Emoji 图标', { exact: true })).toHaveValue('📷');
  await close(page);
});

test('属性先查看后编辑，关闭与取消保护草稿，保存期间保持窗口', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  const value = await fixture(page);
  await page.goto('/home?search=' + encodeURIComponent(value.name));
  const panel = await properties(page, value.name);
  await expect(panel.getByRole('textbox')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
  await expect(panel.getByText('放弃草稿并读取最新', { exact: true })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: '编辑整理信息', exact: true })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('properties-overview-desktop.png') });
  await panel.getByRole('button', { name: '编辑整理信息', exact: true }).click();
  const submit = panel.getByRole('button', { name: '保存', exact: true });
  await expect(submit).toBeDisabled();
  await expect(submit).toBeInViewport();
  await panel.getByLabel('Emoji 图标', { exact: true }).fill('📚');
  await panel.getByRole('button', { name: '关闭', exact: true }).click();
  const confirm = page.getByRole('alertdialog', { name: '放弃未保存的整理信息？', exact: true });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(panel.getByLabel('Emoji 图标', { exact: true })).toHaveValue('📚');
  await panel.getByRole('button', { name: '取消', exact: true }).click();
  await confirm.getByRole('button', { name: '放弃修改', exact: true }).click();
  await expect(panel.getByRole('button', { name: '编辑整理信息', exact: true })).toBeVisible();
  const unchanged = await api(page, '/' + String(value.root.id) + '/annotations');
  expect(unchanged.annotation).toMatchObject({ emoji: '', revision: 0 });
  await panel.getByRole('button', { name: '编辑整理信息', exact: true }).click();
  await panel.getByLabel('Emoji 图标', { exact: true }).fill('📚');
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route('**/native/files/' + String(value.root.id) + '/annotations', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    writes++;
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  try {
    await panel.getByLabel('Emoji 图标', { exact: true }).press('Enter');
    await expect.poll(() => writes).toBe(1);
    await expect(panel.getByRole('button', { name: '关闭', exact: true })).toBeDisabled();
    await expect(submit).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(panel).toBeVisible();
  } finally {
    release();
  }
  await expect(panel.getByText('整理信息已保存', { exact: true })).toBeVisible();
  await expect(panel.getByRole('textbox')).toHaveCount(0);
  expect(writes).toBe(1);
  const stored = await api(page, '/' + String(value.root.id) + '/annotations');
  expect(stored.annotation).toMatchObject({ emoji: '📚', revision: 1 });
  await panel.getByRole('button', { name: '编辑整理信息', exact: true }).click();
  await panel.getByLabel('Emoji 图标', { exact: true }).fill('📃');
  await panel.getByRole('button', { name: '关闭', exact: true }).click();
  await confirm.getByRole('button', { name: '放弃修改', exact: true }).click();
  await expect(panel).toHaveCount(0);
  const preserved = await api(page, '/' + String(value.root.id) + '/annotations');
  expect(preserved.annotation).toMatchObject({ emoji: '📚', revision: 1 });
  await expect(row(page, value.root.id)).toContainText('📚');
});

test('属性冲突和写入失败保留输入，放弃后才重新读取，详情可进入版本历史', async ({ page }) => {
  await login(page);
  const value = await fixture(page);
  await page.goto('/home?parent=' + String(value.root.id));
  let panel = await properties(page, String(value.file.name));
  await panel.getByRole('button', { name: '编辑整理信息', exact: true }).click();
  await panel.getByLabel('Emoji 图标', { exact: true }).fill('📖');
  await writeAnnotations(page, value.file.id, [], [{ key: 'Project', value: '其他窗口保存' }]);
  await panel.getByRole('button', { name: '保存', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('草稿仍保留');
  await expect(panel.getByRole('alert')).toBeFocused();
  await expect(panel.getByLabel('Emoji 图标', { exact: true })).toHaveValue('📖');
  await panel.getByRole('button', { name: '放弃草稿并读取最新', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await confirm.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(panel.getByLabel('Emoji 图标', { exact: true })).toHaveValue('📖');
  await panel.getByRole('button', { name: '放弃草稿并读取最新', exact: true }).click();
  await confirm.getByRole('button', { name: '放弃修改', exact: true }).click();
  panel = page.getByRole('dialog', { name: String(value.file.name), exact: true });
  await expect(panel.getByText('其他窗口保存', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: '编辑整理信息', exact: true }).click();
  await expect(panel.getByLabel('Emoji 图标', { exact: true })).toHaveValue('');
  await panel.getByLabel('Emoji 图标', { exact: true }).fill('✅');
  await page.route(
    '**/native/files/' + String(value.file.id) + '/annotations',
    (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
    { times: 1 },
  );
  await panel.getByRole('button', { name: '保存', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('服务暂时不可用');
  await expect(panel.getByRole('alert')).toBeFocused();
  await expect(panel.getByLabel('Emoji 图标', { exact: true })).toHaveValue('✅');
  await save(page);
  await expect(panel.getByText('其他窗口保存', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: '版本历史', exact: true }).click();
  await expect(page.getByRole('heading', { name: '版本历史', exact: true })).toBeVisible();
  await expect(page.getByText('查看文件信息，整理自己的标签与属性。', { exact: true })).toHaveCount(
    0,
  );
});

test('属性窄屏英文深色长名称与空值可读，固定操作不遮住最后字段', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page);
  const value = await fixture(page);
  const name = 'handover-notes-with-a-long-file-name-' + value.suffix + '.txt';
  await api(page, '/' + String(value.file.id), 'PATCH', { name });
  await writeAnnotations(
    page,
    value.file.id,
    [{ name: 'Project handover', color }],
    [{ key: 'Empty', value: '' }],
  );
  await page.goto('/home?parent=' + String(value.root.id));
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  const originalTheme = await page.getByRole('menuitemradio', { checked: true }).innerText();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  let english = false;
  try {
    await page.getByRole('button', { name: '当前用户', exact: true }).click();
    await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
    english = true;
    await page.setViewportSize({ width: 320, height: 760 });
    await page.getByRole('button', { name: 'Actions for ' + name, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Properties', exact: true }).click();
    const panel = page.getByRole('dialog', { name, exact: true });
    await expect(panel.getByText('Empty value', { exact: true })).toBeVisible();
    expect(
      await panel
        .getByRole('heading', { name, exact: true })
        .evaluate(
          (heading) =>
            heading.getBoundingClientRect().height <=
            Number.parseFloat(getComputedStyle(heading).lineHeight) * 2 + 1,
        ),
    ).toBe(true);
    await expect(
      panel.getByRole('button', { name: 'Edit organization details', exact: true }),
    ).toBeInViewport();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await expect
      .poll(
        async () =>
          (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
      )
      .toEqual([]);
    await page.screenshot({ path: info.outputPath('properties-overview-mobile-dark.png') });
    await panel.getByRole('button', { name: 'Edit organization details', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await panel.getByLabel('Property 1 value', { exact: true }).fill('Last visible field');
    const saveBounds = await panel.getByRole('button', { name: 'Save', exact: true }).boundingBox();
    const cancelBounds = await panel
      .getByRole('button', { name: 'Cancel', exact: true })
      .boundingBox();
    expect(Math.abs(saveBounds!.y - cancelBounds!.y)).toBeLessThan(2);
    await expect(panel.getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
    await expect
      .poll(
        async () =>
          (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
      )
      .toEqual([]);
    await page.screenshot({ path: info.outputPath('properties-edit-mobile-dark.png') });
    await panel.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(panel.getByText('Organization details saved', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Close', exact: true }).click();
    await page.goto('/ui-elements/overlays?overlay=drawer');
    const example = page.getByRole('dialog', { name: 'Supplementary configuration', exact: true });
    await expect(example.getByRole('button', { name: 'Confirm', exact: true })).toBeInViewport();
    await example.getByLabel('Configuration name', { exact: true }).press('Enter');
    await example.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: /^Confirm$/ })).toBeVisible();
  } finally {
    // 恢复偏好，避免跨用例污染同一个预览账号。
    await page.goto('/home');
    if (english) {
      await page.getByRole('button', { name: 'Current user', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Language English', exact: true }).click();
      await page.getByRole('menuitemradio', { name: '简体中文', exact: true }).click();
    }
    await page.getByRole('button', { name: '当前用户', exact: true }).click();
    await page.getByRole('menuitem', { name: /^主题 / }).click();
    await page.getByRole('menuitemradio', { name: originalTheme.trim(), exact: true }).click();
  }
});
