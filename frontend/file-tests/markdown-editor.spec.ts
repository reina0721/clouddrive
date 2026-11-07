import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { openReadingFixtureFolder } from './reading-fixture';

test('私有 Markdown 创建、渲染、编辑和安全图片', async ({ page }, info) => {
  const access = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!access, '使用隔离文件预览。');
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
  await openReadingFixtureFolder(page, 'Markdown验收-');

  let externalRequests = 0;
  await page.route('https://markdown.example.test/**', async (route) => {
    externalRequests++;
    await route.abort('failed');
  });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: '书页 图.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAMAAAABgCAIAAADEouq+AAABJUlEQVR42u3YwQnAIBBFwa3IjiRWYrHeLCB3wRJykE0y8O6CDHzYKO2SHhe+QAAJIAEkgCSABJAAEkASQAJIAAkgCSABJIAEkPQqQPMeh8vzOkAAAQQQQAABBBBAAAEEEEAAAQQQQAABBBBAAAEEEEDfBlR7P1ye1wECCCATZsIAAggggAACCCCAAAIIIIAAAggggBwSHRIBAsiEmTCAAAIIIIAAAggggAACCCCAAAIIIIdEh0SAAALIhJkwgAACCCCAAAIIIIAAAggggAACCCCHRIdEgAAyYSYMIIAAAggggAACCCCAAAIIIIAAAggggAACCCCAAAIIIIAAAggggAACCCCA9M8AEkACSAAJIAkgASSABJAEkAASQAJIAkgACSABJO0W35TXYgdSzxoAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  const queue = page.getByRole('dialog', { name: '上传队列', exact: true });
  await expect(queue.getByText('上传完成', { exact: true })).toBeVisible();
  await queue.getByRole('button', { name: '关闭', exact: true }).click();

  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '新建 Markdown', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  const creation = page.getByRole('dialog', { name: '新建 Markdown', exact: true });
  await creation.getByLabel('名称', { exact: true }).fill('项目笔记.MARKDOWN');
  const source = [
    '# 项目笔记',
    '',
    '需要强调与 *斜体*，以及 ~~旧版~~。',
    '',
    '- 普通项目',
    '- [x] 已完成',
    '',
    '| 字段 | 状态 |',
    '| ---- | ---- |',
    '| 构建 | 已完成 |',
    '',
    '```text',
    'build OK',
    '```',
    '',
    '![书页示意](./书页%20图.png)',
    '',
    '![外部图替代](https://markdown.example.test/pixel.png)',
    '![越界图替代](../书页%20图.png)',
    '',
    '[可用网址](https://example.com/) [危险网址](javascript:alert%281%29)',
    '',
    '<script>window.markdownScriptRan = true;</script>',
    '<img src="https://markdown.example.test/raw.png">',
  ].join('\n');
  const input = creation.getByLabel('文件内容', { exact: true });
  await input.fill(source);
  await input.evaluate((element) => {
    const field = element as HTMLTextAreaElement;
    const start = field.value.indexOf('需要强调');
    field.setSelectionRange(start, start + '需要强调'.length);
  });
  await creation.getByRole('button', { name: '粗体', exact: true }).click();
  await expect(input).toHaveValue(source.replace('需要强调', '**需要强调**'));
  const preview = creation.getByRole('article', { name: '预览', exact: true });
  await expect(preview.getByRole('heading', { name: '项目笔记', exact: true })).toBeVisible();
  await expect(preview.locator('strong')).toHaveText('需要强调');
  await expect(preview.locator('em')).toHaveText('斜体');
  await expect(preview.locator('del')).toHaveText('旧版');
  await expect(preview.getByRole('checkbox')).toBeChecked();
  await expect(preview.getByRole('table')).toContainText('构建');
  await expect(preview.locator('pre code')).toContainText('build OK');
  const cover = preview.getByRole('img', { name: '书页示意', exact: true });
  await expect
    .poll(() => cover.evaluate((node) => (node as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await expect(cover).toHaveAttribute('src', /^blob:/);
  await expect(preview.getByText('外部图替代')).toBeVisible();
  await expect(preview.getByText('越界图替代')).toBeVisible();
  await expect(preview.getByRole('link', { name: '危险网址', exact: true })).toHaveCount(0);
  await expect(preview.getByRole('link', { name: '可用网址', exact: true })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  );
  await expect(preview.locator('script')).toHaveCount(0);
  expect(await page.evaluate(() => 'markdownScriptRan' in window)).toBe(false);
  expect(externalRequests).toBe(0);
  await input.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({ path: info.outputPath('markdown-desktop.png') });
  await creation.getByRole('button', { name: '保存', exact: true }).click();
  await expect(creation).toHaveCount(0);

  const name = '项目笔记.MARKDOWN';
  const item = page.getByRole('button', { name, exact: true });
  await item.click();
  const dialog = page.getByRole('dialog', { name, exact: true });
  const savedPreview = dialog.getByRole('article', { name: '预览', exact: true });
  await expect(savedPreview.locator('strong')).toHaveText('需要强调');
  await expect(dialog.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('文件内容', { exact: true })).toHaveCount(0);
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载', exact: true }).click();
  expect((await download).suggestedFilename()).toBe(name);

  await page.setViewportSize({ width: 320, height: 760 });
  await expect(dialog.getByRole('button', { name: '并排', exact: true })).toHaveCount(0);
  await expect
    .poll(() => dialog.evaluate((node) => node.scrollWidth <= node.clientWidth))
    .toBe(true);
  await page.screenshot({ path: info.outputPath('markdown-mobile.png') });
  await dialog.getByRole('button', { name: '源码', exact: true }).click();
  const savedInput = dialog.getByLabel('文件内容', { exact: true });
  await savedInput.fill('临时修改');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  const discard = page.getByRole('dialog', { name: '放弃未保存的 Markdown 修改？', exact: true });
  await discard.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(savedInput).toHaveValue('临时修改');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await discard.getByRole('button', { name: '放弃修改', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await item.click();
  await expect(savedPreview.locator('strong')).toHaveText('需要强调');
  await dialog.getByRole('button', { name: '源码', exact: true }).click();
  await savedInput.fill('x'.repeat(256 * 1024 + 1));
  await dialog.getByRole('button', { name: '预览', exact: true }).click();
  await expect(savedPreview.getByRole('status')).toContainText('超出渲染大小限制');
  await dialog.getByRole('button', { name: '源码', exact: true }).click();
  await savedInput.fill('x'.repeat(1024 * 1024 + 1));
  await expect(dialog.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await discard.getByRole('button', { name: '放弃修改', exact: true }).click();
  expect(externalRequests).toBe(0);
});
