import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { epubFixture } from '../apps/web/src/test/epub-fixture';
import { openReadingFixtureFolder } from './reading-fixture';

test('真实 EPUB 的目录、章节、包内图片、字号及失败恢复', async ({ page }, info) => {
  const access = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!access, '使用隔离文件预览。');
  const account = JSON.parse((await readFile(access!, 'utf8')).replace(/^\uFEFF/, '')) as {
    username: string;
    password: string;
    url: string;
  };
  expect(new URL(account.url).origin).toBe('http://127.0.0.1:4194');
  let externalRequests = 0;
  await page.route('https://epub.example.test/**', async (route) => {
    externalRequests++;
    await route.abort('failed');
  });
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await openReadingFixtureFolder(page, 'EPUB验收-');
  const choose = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  await (
    await choose
  ).setFiles([
    {
      name: 'book.EPUB',
      mimeType: 'application/epub+zip',
      buffer: Buffer.from(await epubFixture()),
    },
    { name: 'broken.epub', mimeType: 'application/epub+zip', buffer: Buffer.from('broken ZIP') },
  ]);
  const files = page.locator('[data-file-item]');
  await expect(files).toHaveCount(2);
  const tray = page.getByRole('dialog', { name: '上传队列', exact: true });
  if (await tray.isVisible()) await tray.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: 'book.EPUB', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '测试电子书', exact: true });
  const chapter = dialog.getByRole('article', { name: '章节正文' });
  await expect(dialog.getByText('示例作者', { exact: true })).toBeVisible();
  await expect(chapter.getByRole('heading', { name: '第一章', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '上一章', exact: true })).toBeDisabled();
  const image = chapter.getByRole('img', { name: '书内图片', exact: true });
  await expect
    .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  const imageURL = await image.getAttribute('src');
  expect(imageURL).toMatch(/^blob:/);
  await expect(chapter.getByText('外部图片替代文字')).toBeVisible();
  await expect(chapter.getByText('外部链接文字')).toBeVisible();
  await expect(chapter.getByRole('link')).toHaveCount(0);
  expect(externalRequests).toBe(0);
  expect(await page.evaluate(() => 'epubScriptRan' in window)).toBe(false);
  await expect(chapter).toHaveCSS('font-size', '16px');
  await dialog.getByRole('button', { name: '增大字号', exact: true }).click();
  await expect(chapter).toHaveCSS('font-size', '18px');
  await chapter.getByRole('button', { name: '章内跳转', exact: true }).click();
  await expect.poll(() => chapter.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await chapter.getByRole('button', { name: '跨章跳转', exact: true }).click();
  await expect(chapter.getByRole('heading', { name: '第二章', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '下一章', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '上一章', exact: true }).click();
  await expect(chapter.getByRole('heading', { name: '第一章', exact: true })).toBeVisible();
  const contents = dialog.getByRole('button', { name: '目录', exact: true });
  const toc = dialog.getByRole('navigation', { name: '目录', exact: true });
  const firstEntry = toc.getByRole('button', { name: '目录一', exact: true });
  const secondEntry = toc.getByRole('button', { name: '目录二', exact: true });
  await expect(firstEntry).toHaveAttribute('aria-current', 'location');
  await contents.click();
  await expect(toc).toBeHidden();
  await contents.click();
  await secondEntry.click();
  await expect(secondEntry).toHaveAttribute('aria-current', 'location');
  await expect(chapter.getByRole('heading', { name: '第二章', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  await expect
    .poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
  const started = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载', exact: true }).click();
  expect((await started).suggestedFilename()).toBe('book.EPUB');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(
    await page.evaluate(
      async (url) =>
        fetch(url).then(
          () => true,
          () => false,
        ),
      imageURL!,
    ),
  ).toBe(false);
  await page.getByRole('button', { name: 'broken.epub', exact: true }).click();
  const damaged = page.getByRole('dialog', { name: 'broken.epub', exact: true });
  await expect(damaged.getByRole('alert')).toContainText('无法读取此 EPUB');
  await damaged.getByRole('button', { name: '重试', exact: true }).click();
  await expect(damaged.getByRole('alert')).toContainText('无法读取此 EPUB');
  await expect(damaged.getByRole('button', { name: '下载', exact: true })).toBeEnabled();
  await damaged.getByRole('button', { name: '关闭', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'book.EPUB', exact: true }).click();
  await expect(chapter.getByRole('heading', { name: '第二章', exact: true })).toBeVisible();
  await expect(chapter).toHaveCSS('font-size', '18px');
  await expect
    .poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await dialog.getByRole('button', { name: '从头阅读', exact: true }).click();
  await expect(chapter.getByRole('heading', { name: '第一章', exact: true })).toBeInViewport();
  const ratio = () =>
    chapter.evaluate(
      (element) => element.scrollTop / (element.scrollHeight - element.clientHeight),
    );
  await chapter.evaluate((element) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
  });
  await expect.poll(ratio).toBeCloseTo(0.5, 1);
  await dialog.getByRole('button', { name: '添加书签', exact: true }).click();
  const savedBookmark = dialog.getByRole('button', { name: '第 1 章 · 50%', exact: true });
  await expect(savedBookmark).toBeVisible();
  await secondEntry.click();
  await expect(chapter.getByRole('heading', { name: '第二章', exact: true })).toBeVisible();
  await savedBookmark.click();
  await expect.poll(ratio).toBeCloseTo(0.5, 1);
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: 'book.EPUB', exact: true }).click();
  await expect.poll(ratio).toBeCloseTo(0.5, 1);
  await expect(savedBookmark).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'book.EPUB', exact: true }).click();
  await expect.poll(ratio).toBeCloseTo(0.5, 1);
  await dialog.getByRole('button', { name: '移除书签 · 第 1 章 · 50%', exact: true }).click();
  await expect(savedBookmark).toHaveCount(0);
  await dialog.getByRole('button', { name: '从头阅读', exact: true }).click();
  await expect.poll(ratio).toBe(0);
  const pages = dialog.getByRole('button', { name: '切换为翻页', exact: true });
  const scroll = dialog.getByRole('button', { name: '切换为连续滚动', exact: true });
  await pages.click();
  const columns = chapter.locator(':scope > div');
  await expect(columns).toHaveCSS('column-count', '2');
  const previousPage = dialog.getByRole('button', { name: '上一页', exact: true });
  const nextPage = dialog.getByRole('button', { name: '下一页', exact: true });
  const horizontal = () => chapter.evaluate((element) => element.scrollLeft);
  await expect(previousPage).toBeDisabled();
  await expect(nextPage).toBeEnabled();
  await page.screenshot({ path: info.outputPath('epub-desktop.png') });
  await nextPage.click();
  await expect.poll(horizontal).toBeGreaterThan(0);
  await previousPage.click();
  await expect.poll(horizontal).toBe(0);
  await chapter.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(horizontal).toBeGreaterThan(0);
  await page.keyboard.press('PageUp');
  await expect.poll(horizontal).toBe(0);
  await chapter.getByRole('button', { name: '章内跳转', exact: true }).click();
  await expect(chapter.getByRole('heading', { name: '本章尾部', exact: true })).toBeInViewport();
  await expect(nextPage).toBeDisabled();
  await dialog.getByRole('button', { name: '从头阅读', exact: true }).click();
  await expect.poll(horizontal).toBe(0);
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'book.EPUB', exact: true }).click();
  await expect(scroll).toBeVisible();
  await expect(columns).toHaveCSS('column-count', '1');
  await expect(toc).toBeHidden();
  await expect.poll(() => chapter.evaluate((element) => element.clientHeight)).toBeGreaterThan(240);
  await expect
    .poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
  await page.screenshot({ path: info.outputPath('epub-mobile.png') });
  await nextPage.click();
  await expect.poll(horizontal).toBeGreaterThan(0);
  await scroll.click();
  await expect(columns).toHaveCSS('column-count', 'auto');
  await expect.poll(ratio).toBeGreaterThan(0);
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await page.evaluate(() => {
    const original = Reflect.getOwnPropertyDescriptor(Storage.prototype, 'getItem')?.value as (
      this: Storage,
      key: string,
    ) => string | null;
    Storage.prototype.getItem = function (key: string) {
      if (key.startsWith('clouddrive.files.epub.'))
        throw new DOMException('denied', 'SecurityError');
      return original.call(this, key);
    };
  });
  await page.getByRole('button', { name: 'book.EPUB', exact: true }).click();
  await expect(dialog.getByText('此浏览器无法保存阅读进度，仍可继续阅读。')).toBeVisible();
  await expect(chapter.getByRole('heading', { name: '第一章', exact: true })).toBeInViewport();
  await dialog.getByRole('button', { name: '下一章', exact: true }).click();
  await expect(chapter.getByRole('heading', { name: '第二章', exact: true })).toBeInViewport();
  expect(externalRequests).toBe(0);
});
