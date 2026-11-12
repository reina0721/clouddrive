import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { StoragePolicy, StorageNameRulesView } from '../surfaces/src/files/storage-policy';
import { readPreviewAccess } from './reading-fixture';
import { customizeLimit, loginStorage, storageRequest, storageSection } from './storage-fixture';

test.use({ actionTimeout: 15_000 });
test.beforeEach(() =>
  test.skip(!process.env.CLOUDDRIVE_FILE_TEST_ACCESS, '仅使用显式指定的隔离预览。'),
);
async function openLimits(page: Page) {
  await page.getByRole('main').getByRole('button', { name: '编辑上传限额', exact: true }).click();
  return page.getByRole('dialog', { name: '编辑上传限额', exact: true });
}
async function restorePolicy(page: Page, initial: StoragePolicy) {
  const latest = await storageRequest<StoragePolicy>(page);
  await storageRequest(page, '', 'PUT', {
    revision: latest.revision,
    overrides: initial.overrides,
  });
}
async function accessCheck(page: Page) {
  await expect
    .poll(
      async () =>
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    )
    .toEqual([]);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

test('关闭未保存限额可继续编辑或明确放弃，取消不会写入', async ({ page }) => {
  await loginStorage(page);
  const initial = await storageRequest<StoragePolicy>(page);
  const dialog = await openLimits(page);
  await customizeLimit(page, dialog, '上传分片上限', '2.25');
  await page.keyboard.press('Escape');
  const discard = page.getByRole('alertdialog', { name: '放弃未保存的更改？', exact: true });
  await expect(discard).toContainText('关闭后，本次输入将丢失。');
  await discard.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(dialog.getByRole('textbox', { name: '上传分片上限', exact: true })).toHaveValue(
    '2.25',
  );
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await discard.getByRole('button', { name: '放弃更改', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await storageRequest<StoragePolicy>(page)).revision).toBe(initial.revision);
});

test('真实保存期间窗口保留，关闭与重复提交受阻', async ({ page }) => {
  await loginStorage(page);
  const initial = await storageRequest<StoragePolicy>(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await page.route('**/api/console/v1/native/files/storage-policy', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue();
    writes++;
    await gate;
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  try {
    const dialog = await openLimits(page);
    await customizeLimit(
      page,
      dialog,
      '上传分片上限',
      initial.overrides.chunkBytes === 2097152 ? '1.5' : '2',
    );
    await dialog.getByRole('button', { name: '保存限额', exact: true }).click();
    await expect.poll(() => writes).toBe(1);
    await expect(dialog.getByRole('button', { name: '保存限额', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('textbox', { name: '上传分片上限', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    expect(writes).toBe(1);
    release();
    await expect(dialog).toHaveCount(0);
    expect(writes).toBe(1);
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
    await restorePolicy(page, initial);
  }
});

test('限额冲突保留草稿，读取失败不解除冲突，成功读取才替换输入', async ({ page }) => {
  await loginStorage(page);
  const initial = await storageRequest<StoragePolicy>(page);
  try {
    const dialog = await openLimits(page);
    await customizeLimit(page, dialog, '上传分片上限', '2');
    await storageRequest(page, '', 'PUT', {
      revision: initial.revision,
      overrides: { ...initial.overrides, chunkBytes: 1048576 },
    });
    const save = dialog.getByRole('button', { name: '保存限额', exact: true });
    await save.click();
    await expect(dialog.getByRole('alert')).toContainText('配置已在另一处更新');
    await expect(dialog.getByRole('textbox', { name: '上传分片上限', exact: true })).toHaveValue(
      '2',
    );
    await expect(save).toBeDisabled();
    await dialog.getByRole('button', { name: '读取最新配置', exact: true }).click();
    const discard = page.getByRole('alertdialog', { name: '放弃未保存的更改？', exact: true });
    await expect(discard).toContainText('读取最新配置会替换本次输入。');
    await discard.getByRole('button', { name: '继续编辑', exact: true }).click();
    await page.route('**/api/console/v1/native/files/storage-policy', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 503, json: { error: { code: 'unavailable' } } })
        : route.continue(),
    );
    await dialog.getByRole('button', { name: '读取最新配置', exact: true }).click();
    await discard.getByRole('button', { name: '放弃更改', exact: true }).click();
    await expect(discard).toHaveCount(0);
    await expect(dialog.getByRole('alert')).toContainText('未能读取最新配置');
    await expect(save).toBeDisabled();
    await expect(dialog.getByRole('textbox', { name: '上传分片上限', exact: true })).toHaveValue(
      '2',
    );
    await page.unrouteAll({ behavior: 'wait' });
    await dialog.getByRole('button', { name: '读取最新配置', exact: true }).click();
    await discard.getByRole('button', { name: '放弃更改', exact: true }).click();
    await expect(discard).toHaveCount(0);
    await expect(dialog.getByRole('textbox', { name: '上传分片上限', exact: true })).toHaveValue(
      '1',
    );
    await expect(save).toBeDisabled();
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(storageSection(page, '上传限额')).toContainText('1 MiB');
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    await restorePolicy(page, initial);
  }
});

test('名称规则的无效表达式与版本冲突保留输入，并能重新读取', async ({ page }) => {
  await loginStorage(page);
  const initial = await storageRequest<StorageNameRulesView>(page, '/name-rules');
  try {
    await page.getByRole('main').getByRole('button', { name: '编辑名称规则', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '编辑名称规则', exact: true });
    const pattern = dialog.getByRole('textbox', { name: '文件名正则', exact: true });
    await pattern.fill('(');
    await dialog.getByRole('textbox', { name: '试测文件名', exact: true }).fill('sample.txt');
    await dialog.getByRole('button', { name: '测试名称', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('请检查扩展名列表');
    await dialog.getByRole('button', { name: '保存规则', exact: true }).click();
    await expect(dialog.getByRole('alert').first()).toContainText('请检查扩展名列表');
    await expect(pattern).toHaveValue('(');
    expect((await storageRequest<StorageNameRulesView>(page, '/name-rules')).revision).toBe(
      initial.revision,
    );
    await pattern.fill('^draft');
    await storageRequest(page, '/name-rules', 'PUT', {
      revision: initial.revision,
      rules: { ...initial.rules, pattern: '^server' },
    });
    await dialog.getByRole('button', { name: '保存规则', exact: true }).click();
    await expect(dialog.getByRole('alert').first()).toContainText('配置已在另一处更新');
    await expect(pattern).toHaveValue('^draft');
    await dialog.getByRole('button', { name: '读取最新配置', exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: '放弃更改', exact: true })
      .click();
    await expect(pattern).toHaveValue('^server');
    await expect(dialog.getByRole('button', { name: '保存规则', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(storageSection(page, '上传名称规则')).toContainText('^server');
  } finally {
    const latest = await storageRequest<StorageNameRulesView>(page, '/name-rules');
    await storageRequest(page, '/name-rules', 'PUT', {
      revision: latest.revision,
      rules: initial.rules,
    });
  }
});

async function consoleWrite(page: Page, path: string, method: string, body: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const { token } = (await (await fetch('/api/console/v1/auth/csrf')).json()) as {
        token: string;
      };
      const response = await fetch('/api/console/v1' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Storage account fixture HTTP ' + response.status);
      return (await response.json()) as Record<string, unknown>;
    },
    { path, method, body },
  );
}
test('只读存储账户能读取摘要和用量，不呈现编辑控件', async ({ page, browser }) => {
  await loginStorage(page);
  const suffix = randomUUID().slice(0, 8);
  const role = (
    await consoleWrite(page, '/roles', 'POST', { name: '存储只读-' + suffix, permissions: [] })
  ).role as { id: string };
  await consoleWrite(page, '/native/iam/roles/' + role.id + '/permissions', 'PUT', {
    expectedRoleVersion: 1,
    permissionKeys: ['files:storage-policy:read'],
  });
  const credentials = {
    ...readPreviewAccess(),
    username: 'storage-' + suffix + '@clouddrive.test',
    password: randomUUID(),
  };
  await consoleWrite(page, '/users', 'POST', {
    email: credentials.username,
    password: credentials.password,
    name: '存储只读-' + suffix,
    roleIds: [role.id],
    status: 'active',
  });
  const context = await browser.newContext({
    baseURL: readPreviewAccess().origin,
    locale: 'zh-CN',
  });
  try {
    const reader = await context.newPage();
    await loginStorage(reader, credentials);
    const main = reader.getByRole('main');
    await expect(main.getByText('当前账户只有查看权限。', { exact: true })).toHaveCount(2);
    await expect(main.getByRole('button', { name: /编辑/ })).toHaveCount(0);
    await expect(main.getByRole('textbox')).toHaveCount(0);
    await main.getByRole('button', { name: '计算内容用量', exact: true }).click();
    await expect(main.getByText('已引用对象', { exact: true })).toBeVisible();
    await accessCheck(reader);
  } finally {
    await context.close();
  }
});

test('320px 英文深色编辑与公共小数输入保持可读、焦点和无障碍', async ({ page }, info) => {
  await loginStorage(page);
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 800 });
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Edit upload limits', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Edit upload limits', exact: true });
  await accessCheck(page);
  await expect
    .poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
  await page.screenshot({ path: info.outputPath('storage-limits-dark-english.png') });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto('/ui-elements/forms');
  const decimal = page.getByRole('textbox', { name: 'Decimal input', exact: true });
  await expect(decimal).toHaveAttribute('inputmode', 'decimal');
  await decimal.fill('1.5');
  await expect(decimal).toHaveValue('1.5');
});
