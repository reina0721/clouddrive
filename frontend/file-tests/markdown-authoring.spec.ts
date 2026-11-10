import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { openReadingFixtureFolder } from './reading-fixture';

async function selectText(field: Locator, value: string) {
  await field.evaluate((node, selected) => {
    const textarea = node as HTMLTextAreaElement;
    const start = textarea.value.indexOf(selected);
    if (start < 0) throw new Error('找不到选中文字');
    textarea.focus();
    textarea.setSelectionRange(start, start + selected.length);
  }, value);
}

async function appendAtEnd(field: Locator) {
  await field.evaluate((node) => {
    const textarea = node as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
}

async function chooseImage(page: Page, dialog: Locator, name: string, buffer: Buffer) {
  const choosing = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: '插入图片', exact: true }).click();
  const picker = await choosing;
  expect(picker.isMultiple()).toBe(false);
  await picker.setFiles({ name, mimeType: 'image/png', buffer });
}

test('Markdown 格式、撤销与同目录图片发布', async ({ page }, info) => {
  const access = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!access, '使用隔离文件预览。');
  const account = JSON.parse((await readFile(access!, 'utf8')).replace(/^\uFEFF/, '')) as {
    username: string;
    password: string;
    url: string;
  };
  expect(new URL(account.url).origin).toBe('http://127.0.0.1:4194');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await openReadingFixtureFolder(page, 'Markdown编写-');

  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '新建 Markdown', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  const newDocument = page.getByRole('dialog', { name: '新建 Markdown', exact: true });
  await newDocument.getByLabel('名称', { exact: true }).fill('写作演示');
  await newDocument.getByLabel('文件内容', { exact: true }).fill('文件笔记');
  await newDocument.getByRole('button', { name: '保存', exact: true }).click();
  await expect(newDocument).toHaveCount(0);
  const fileName = '写作演示.md';
  const file = page.getByRole('button', { name: fileName, exact: true });
  await file.click();

  const editor = page.getByRole('dialog', { name: fileName, exact: true });
  const button = (name: string) => editor.getByRole('button', { name, exact: true });
  await button('并排').click();
  const input = editor.getByLabel('文件内容', { exact: true });
  const preview = editor.getByRole('article', { name: '预览', exact: true });

  await input.fill(
    '文件笔记\n副标题\n\n一个\n两个\n\n引用甲\n引用乙\n\n重点旧文\n\na' +
      String.fromCharCode(96) +
      'b\n\n项目网址',
  );
  await selectText(input, '一个\n两个');
  await button('列表').click();
  expect(await input.inputValue()).toContain('- 一个\n- 两个');
  await button('撤销').click();
  for (const [source, action, result] of [
    ['文件笔记', '一级标题', '# 文件笔记'],
    ['副标题', '标题', '## 副标题'],
    ['一个\n两个', '有序列表', '1. 一个\n2. 两个'],
    ['引用甲\n引用乙', '引用', '> 引用甲\n> 引用乙'],
    ['旧文', '删除线', '~~旧文~~'],
    [
      'a' + String.fromCharCode(96) + 'b',
      '行内代码',
      String.fromCharCode(96, 96, 97, 96, 98, 96, 96),
    ],
  ]) {
    await selectText(input, source ?? '');
    await button(action ?? '').click();
    expect(await input.inputValue()).toContain(result);
  }
  await selectText(input, '重点');
  await input.press('Control+b');
  expect(await input.inputValue()).toContain('**重点**');
  await input.press('Control+z');
  expect(await input.inputValue()).not.toContain('**重点**');
  expect(
    await input.evaluate((node) => {
      const field = node as HTMLTextAreaElement;
      return field.value.slice(field.selectionStart, field.selectionEnd);
    }),
  ).toBe('重点');
  await button('重做').click();
  expect(await input.inputValue()).toContain('**重点**');
  await button('撤销').click();
  await input.press('Control+i');
  expect(await input.inputValue()).toContain('*重点*');
  await expect(button('重做')).toBeDisabled();

  await selectText(input, '项目网址');
  await input.press('Control+k');
  const link = page.getByRole('dialog', { name: '插入链接', exact: true });
  await expect(link.getByLabel('链接文字')).toHaveValue('项目网址');
  await link.getByLabel('链接地址').fill('javascript:alert(1)');
  await expect(link.getByRole('button', { name: '插入', exact: true })).toBeDisabled();
  await link.getByLabel('链接地址').fill('https://example.com/notes?q=one(two)');
  await link.getByRole('button', { name: '插入', exact: true }).click();
  await expect(preview.getByRole('link', { name: '项目网址' })).toHaveAttribute(
    'href',
    'https://example.com/notes?q=one(two)',
  );

  await appendAtEnd(input);
  await button('分隔线').click();
  await appendAtEnd(input);
  await button('表格').click();
  await expect(preview.locator('hr')).toHaveCount(1);
  await expect(preview.getByRole('table')).toContainText('列 1');
  await expect(preview.getByRole('list').first()).toContainText('一个');
  await expect(preview.locator('blockquote')).toContainText('引用乙');
  await expect(preview.locator('del')).toHaveText('旧文');

  const png = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 192;
      canvas.height = 96;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法生成图片');
      context.fillStyle = '#276ac4';
      context.fillRect(0, 0, 192, 96);
      context.fillStyle = '#eea730';
      context.fillRect(32, 20, 128, 56);
      return canvas.toDataURL('image/png').split(',')[1] ?? '';
    }),
    'base64',
  );

  const unchanged = await input.inputValue();
  await chooseImage(
    page,
    editor,
    '改名图片.png',
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  );
  await expect(editor.getByRole('alert')).toContainText('请选择可预览的');
  await expect(input).toHaveValue(unchanged);
  await chooseImage(
    page,
    editor,
    '大图片.png',
    Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]),
  );
  await expect(editor.getByRole('alert')).toContainText('图片不能超过 2 MiB');
  await expect(input).toHaveValue(unchanged);

  let receivedCommit!: () => void;
  let releaseCommit!: () => void;
  const commitSeen = new Promise<void>((resolve) => {
    receivedCommit = resolve;
  });
  const allowCommit = new Promise<void>((resolve) => {
    releaseCommit = resolve;
  });
  await page.route(
    '**/native/files/transfers/*/commit',
    async (route) => {
      receivedCommit();
      await allowCommit;
      await route.continue();
    },
    { times: 1 },
  );
  try {
    await chooseImage(page, editor, '取消等待.png', png);
    await commitSeen;
    await expect(editor.getByRole('status')).toContainText('正在把图片上传');
    await expect(button('保存')).toBeDisabled();
    await expect(input).toHaveValue(unchanged);
    await button('取消等待').click();
    await expect(editor.getByRole('status')).toContainText('已停止等待');
  } finally {
    releaseCommit();
  }
  await expect(input).toHaveValue(unchanged);

  const pictureName = '写作 插图(1).png';
  await appendAtEnd(input);
  await input.press('End');
  await input.press('Enter');
  await input.press('Enter');
  await chooseImage(page, editor, pictureName, png);
  await expect(editor.getByRole('status').filter({ hasText: '图片已上传并插入' })).toBeVisible();
  const inserted = await input.inputValue();
  expect(inserted).toContain(
    '![写作 插图(1)](./' +
      encodeURIComponent(pictureName).replaceAll('(', '%28').replaceAll(')', '%29') +
      ')',
  );
  const image = preview.getByRole('img', { name: '写作 插图(1)', exact: true });
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(192);
  await expect(image).toHaveAttribute('src', /^blob:/);
  await page.screenshot({ path: info.outputPath('markdown-authoring-desktop.png') });

  await chooseImage(
    page,
    editor,
    pictureName,
    Buffer.concat([png, Buffer.from('different bytes')]),
  );
  await expect(editor.getByRole('alert')).toContainText('同名文件或目标冲突');
  await expect(input).toHaveValue(inserted);
  await expect(image).toBeVisible();
  await button('保存').click();
  await expect(editor).toHaveCount(0);

  const imageRevision = await page.evaluate(async (name) => {
    const parent = new URLSearchParams(location.search).get('parent') ?? '';
    const response = await fetch(
      '/api/console/v1/native/files?' + new URLSearchParams({ parent }).toString(),
    );
    if (!response.ok) throw new Error('无法检查同目录图片');
    const { items } = (await response.json()) as {
      items: { name: string; contentRevision: number }[];
    };
    return items.find((entry) => entry.name === name)?.contentRevision;
  }, pictureName);
  expect(imageRevision).toBe(1);

  await file.click();
  await expect(image).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await button('源码').click();
  await expect(input).toHaveValue(inserted);
  await expect
    .poll(() => editor.evaluate((node) => node.scrollWidth <= node.clientWidth))
    .toBe(true);
  await page.screenshot({ path: info.outputPath('markdown-authoring-mobile.png') });
});
