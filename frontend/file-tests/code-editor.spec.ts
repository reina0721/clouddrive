import { readFile } from 'node:fs/promises';
import { expect, test, type Locator } from '@playwright/test';
import { openReadingFixtureFolder } from './reading-fixture';

test.use({ actionTimeout: 15_000 });

test('代码编辑、搜索替换、版本冲突及原始编码保存', async ({ page, context }, info) => {
  test.setTimeout(120_000);
  const access = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!access, '使用隔离文件预览。');
  const account = JSON.parse((await readFile(access!, 'utf8')).replace(/^\uFEFF/, '')) as {
    username: string;
    password: string;
    url: string;
  };
  const select = async (trigger: Locator, option: string) => {
    await trigger.click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  expect(new URL(account.url).origin).toBe('http://127.0.0.1:4194');
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await openReadingFixtureFolder(page, '代码验收-');
  const folder = page.url();
  const code = [
    'function greet(name) {',
    '  const color = "orange";',
    '  return { name, color };',
    '}',
    '',
    `const longLine = "${'long '.repeat(60)}";`,
    '',
  ].join('\n');
  const choose = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  await (
    await choose
  ).setFiles([
    {
      name: 'source.js',
      mimeType: 'text/javascript',
      buffer: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(code)]),
    },
    {
      name: 'legacy.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('d6d0cec40d0ad6d0cec40d0a', 'hex'),
    },
    {
      name: 'unicode.txt',
      mimeType: 'text/plain',
      buffer: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Unicode 文本', 'utf16le')]),
    },
  ]);
  const tray = page.getByRole('dialog', { name: '上传队列', exact: true });
  await expect(tray.getByText('上传完成', { exact: true })).toHaveCount(3);
  await tray.getByRole('button', { name: '关闭', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'source.js', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'source.js', exact: true });
  const editor = dialog.getByLabel('文件内容', { exact: true });
  const language = dialog.getByRole('button', { name: /语言/ });
  await expect(editor).toContainText('function greet(name)');
  await expect(language).toContainText('自动 · JavaScript');
  await expect(dialog.getByText('UTF-8 · LF', { exact: true })).toBeVisible();
  const keyword = editor
    .locator('span')
    .filter({ hasText: /^function$/ })
    .first();
  await expect(keyword).toBeVisible();
  await expect(
    dialog.locator('.cm-lineNumbers .cm-gutterElement').filter({ hasText: /^2$/ }),
  ).toBeVisible();
  await select(language, '纯文本');
  await expect(keyword).toHaveCount(0);
  await select(language, 'JavaScript');
  await expect(keyword).toBeVisible();
  await editor.press('Control+Home');
  await editor.press('End');
  await expect(editor.locator('.cm-matchingBracket').first()).toBeVisible();
  const fold = dialog.locator('.cm-foldGutter [title="折叠"]:visible').first();
  await fold.click();
  await expect(editor).not.toContainText('const color');
  await dialog.locator('.cm-foldGutter [title="展开"]:visible').first().click();
  await expect(editor).toContainText('const color');
  await dialog.getByRole('button', { name: '跳转到行', exact: true }).click();
  const lineNumber = dialog.locator('.cm-goto-line input');
  await lineNumber.fill('2:3');
  await lineNumber.press('Enter');
  await expect(dialog.getByText('第 2 行，第 4 列', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '增加缩进', exact: true }).click();
  await expect
    .poll(() => editor.locator('.cm-line').nth(1).textContent())
    .toBe('    const color = "orange";');
  await dialog.getByRole('button', { name: '撤销', exact: true }).click();
  await expect
    .poll(() => editor.locator('.cm-line').nth(1).textContent())
    .toBe('  const color = "orange";');
  await dialog.getByRole('button', { name: '重做', exact: true }).click();
  await expect
    .poll(() => editor.locator('.cm-line').nth(1).textContent())
    .toBe('    const color = "orange";');
  await dialog.getByRole('button', { name: '查找与替换', exact: true }).click();
  await dialog.getByRole('textbox', { name: '查找', exact: true }).fill('orange');
  await dialog.getByRole('button', { name: '下一个', exact: true }).click();
  await expect(dialog.locator('.cm-searchMatch-selected')).toContainText('orange');
  await dialog.getByRole('textbox', { name: '替换', exact: true }).fill('purple');
  await dialog.getByRole('button', { name: '全部替换', exact: true }).click();
  await expect(editor).toContainText('purple');
  await dialog.getByRole('button', { name: '关闭查找', exact: true }).click();
  const longLine = editor.locator('.cm-line').filter({ hasText: /const longLine/ });
  const lineHeight = () => longLine.evaluate((line) => line.getBoundingClientRect().height);
  const unwrapped = await lineHeight();
  await dialog.getByRole('checkbox', { name: '自动折行', exact: true }).press('Space');
  await expect.poll(lineHeight).toBeGreaterThan(unwrapped);
  await page.screenshot({ path: info.outputPath('code-desktop.png'), animations: 'disabled' });

  const second = await context.newPage();
  try {
    await second.goto(folder);
    await second.getByRole('button', { name: 'source.js', exact: true }).click();
    const secondDialog = second.getByRole('dialog', { name: 'source.js', exact: true });
    const draft = secondDialog.getByLabel('文件内容', { exact: true });
    await expect(draft).toContainText('orange');
    await dialog.getByRole('button', { name: '保存', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await draft.fill('const draft = true;');
    await secondDialog.getByRole('button', { name: '保存', exact: true }).click();
    await expect(secondDialog.getByRole('alert')).toContainText('内容已被其他窗口更改');
    await expect(draft).toHaveText('const draft = true;');
    await secondDialog.getByRole('button', { name: '关闭', exact: true }).click();
    const guard = second.getByRole('dialog', { name: '放弃未保存的文本修改？', exact: true });
    await guard.getByRole('button', { name: '继续编辑', exact: true }).click();
    await expect(draft).toHaveText('const draft = true;');
    await secondDialog.getByRole('button', { name: '关闭', exact: true }).click();
    await guard.getByRole('button', { name: '放弃修改', exact: true }).click();
    await expect(secondDialog).toHaveCount(0);
  } finally {
    await second.close();
  }

  await page.setViewportSize({ width: 375, height: 760 });
  await page.getByRole('button', { name: 'legacy.txt', exact: true }).click();
  const legacy = page.getByRole('dialog', { name: 'legacy.txt', exact: true });
  const legacyEditor = legacy.getByLabel('文件内容', { exact: true });
  const encoding = legacy.getByRole('button', { name: /读取编码/ });
  await expect(legacy.getByRole('alert')).toContainText('无法用所选编码读取');
  await select(encoding, 'GB18030 / GBK');
  await expect(legacyEditor).toContainText('中文');
  await expect(legacy.getByText('GB18030 · CRLF · 保存为 UTF-8', { exact: true })).toBeVisible();
  await expect
    .poll(() => legacy.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
  await page.screenshot({ path: info.outputPath('code-mobile.png'), animations: 'disabled' });
  await legacyEditor.fill('中文更新\n另一行');
  await expect(encoding).toBeDisabled();
  await legacy.getByRole('button', { name: '保存', exact: true }).click();
  await expect(legacy).toHaveCount(0);
  await page.getByRole('button', { name: 'legacy.txt', exact: true }).click();
  await expect(legacyEditor).toContainText('中文更新');
  await expect(legacy.getByText('UTF-8 · CRLF', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await legacy.getByRole('button', { name: '下载', exact: true }).click();
  expect(await readFile(await (await download).path(), 'utf8')).toBe('中文更新\r\n另一行');
  await legacy.getByRole('button', { name: '关闭', exact: true }).click();

  await page.getByRole('button', { name: 'unicode.txt', exact: true }).click();
  const unicode = page.getByRole('dialog', { name: 'unicode.txt', exact: true });
  await expect(unicode.getByLabel('文件内容', { exact: true })).toHaveText('Unicode 文本');
  const unicodeEncoding = unicode.getByRole('button', { name: /读取编码/ });
  await select(unicodeEncoding, 'UTF-8');
  await expect(unicode.getByRole('alert')).toContainText('编辑区保留此前内容');
  await expect(unicode.getByLabel('文件内容', { exact: true })).toHaveText('Unicode 文本');
  await expect(unicode.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
  await select(unicodeEncoding, '自动识别');
  await expect(unicode.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await unicode.getByRole('button', { name: '关闭', exact: true }).click();

  await page.route('**/api/console/v1/native/files?**', async (route) => {
    const response = await route.fetch();
    if (!response.ok()) {
      await route.fulfill({ response });
      return;
    }
    const listing = (await response.json()) as Record<string, unknown>;
    await route.fulfill({ response, json: { ...listing, maxTextBytes: 64 } });
  });
  await page.reload();
  await page.getByRole('button', { name: 'legacy.txt', exact: true }).click();
  await legacyEditor.fill('界'.repeat(30));
  await expect(legacy.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
});
