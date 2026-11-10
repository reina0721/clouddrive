import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openReadingFixtureFolder } from './reading-fixture';
const accessPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS!;
async function login(page: Page) {
  const a = JSON.parse((await readFile(accessPath, 'utf8')).replace(/^\uFEFF/, '')) as {
    username: string;
    password: string;
  };
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(a.username);
  await page.getByLabel('密码', { exact: true }).fill(a.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}
async function upload(page: Page, path: string) {
  const name = 'pdf-' + Date.now() + '.pdf';
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  await (
    await chooser
  ).setFiles({ name, mimeType: 'application/pdf', buffer: await readFile(path) });
  const queue = page.getByRole('dialog', { name: '上传队列', exact: true });
  await expect(queue.getByText('上传完成', { exact: true })).toBeVisible();
  await queue.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
  return page.getByRole('dialog', { name, exact: true });
}
const fixture = (name: string) => resolve(__dirname, 'fixtures/pdf', name);
test.beforeEach(async ({ page }) => {
  await login(page);
  await openReadingFixtureFolder(page, 'PDF验收-');
});
test('F261–277：真实PDF分页显示文字查找导航与本地组件', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const d = await upload(page, fixture('reader.pdf'));
  const frame = d.frameLocator('iframe');
  await expect(frame.locator('.page[data-page-number="1"] canvas').first()).toBeVisible();
  await expect(d.getByText('第 1 / 10 页', { exact: true })).toBeVisible();
  await expect(frame.locator('.textLayer').first()).toContainText('Alpha');
  await d.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(d.getByText('第 2 / 10 页', { exact: true })).toBeVisible();
  await d.getByLabel('页码', { exact: true }).fill('99');
  await d.getByRole('button', { name: '跳转', exact: true }).click();
  await expect(d.getByRole('alert')).toContainText('整数页码');
  await d.getByLabel('页码', { exact: true }).fill('4');
  await d.getByRole('button', { name: '跳转', exact: true }).click();
  await expect(d.getByText('第 4 / 10 页', { exact: true })).toBeVisible();
  await d.getByRole('button', { name: '查找文字', exact: true }).click();
  await d.getByRole('searchbox', { name: '全文查找', exact: true }).fill('Alpha');
  await d.getByRole('button', { name: '查找', exact: true }).click();
  await expect(d.getByText(/匹配 \d+ \/ 40/)).toBeVisible();
  await d.getByText('区分大小写', { exact: true }).click();
  await expect(d.getByRole('checkbox', { name: '区分大小写', exact: true })).toBeChecked();
  await d.getByRole('button', { name: '查找', exact: true }).click();
  await expect(d.getByText(/匹配 \d+ \/ 10/)).toBeVisible();
  await d.getByText('区分大小写', { exact: true }).click();
  await d.getByText('完整单词', { exact: true }).click();
  await d.getByRole('button', { name: '查找', exact: true }).click();
  await expect(d.getByText(/匹配 \d+ \/ 30/)).toBeVisible();
  await d.getByRole('button', { name: '下个匹配', exact: true }).click();
  await expect(d.getByText(/匹配 \d+ \/ 30/)).toBeVisible();
  await d.getByRole('button', { name: '上个匹配', exact: true }).click();
  await d.getByRole('button', { name: '清除查找', exact: true }).click();
  await expect(frame.locator('.textLayer .highlight')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('pdf-reader-desktop.png'), fullPage: false });
  expect(errors).toEqual([]);
});
test('F278：真实加密PDF密码错误后重试', async ({ page }) => {
  const d = await upload(page, fixture('encrypted.pdf'));
  await expect(d.getByText('此PDF需要密码。', { exact: true })).toBeVisible();
  await expect(d.getByRole('button', { name: '图片标注', exact: true })).toBeDisabled();
  await d.getByLabel('PDF密码（不保存）', { exact: true }).fill('wrong');
  await d.getByRole('button', { name: '打开文档', exact: true }).click();
  await expect(d.getByText('密码不正确，请重试。', { exact: true })).toBeVisible();
  await d.getByLabel('PDF密码（不保存）', { exact: true }).fill('reader-test-password');
  await d.getByRole('button', { name: '打开文档', exact: true }).click();
  await expect(d.getByText('第 1 / 10 页', { exact: true })).toBeVisible();
  await expect(d.frameLocator('iframe').locator('canvas').first()).toBeVisible();
});
test('拒绝超过受控页数的真实PDF', async ({ page }) => {
  const d = await upload(page, fixture('over-pages.pdf'));
  await expect(d.getByRole('alert')).toContainText('超过阅读限制');
});
async function choose(page: Page, d: ReturnType<Page['getByRole']>, menu: string, item: string) {
  await d.getByRole('button', { name: menu, exact: true }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
  if (menu === '标注工具') {
    const modes: Record<string, string> = {
      阅读与选择: 'none',
      文字标注: 'text',
      高亮标注: 'highlight',
      手绘标注: 'ink',
    };
    await expect(d.locator('iframe')).toHaveAttribute('data-pdf-editor', modes[item]!);
  }
  await expect(d.locator('iframe')).not.toHaveAttribute('inert', '');
}
test('F264–277：缩放旋转、缩略图、大纲、内部链接及位置历史', async ({ page }) => {
  const d = await upload(page, fixture('reader.pdf')),
    frame = d.frameLocator('iframe');
  await expect(frame.locator('canvas').first()).toBeVisible();
  await choose(page, d, '缩放与显示', '末页');
  await expect(d.getByText('第 10 / 10 页', { exact: true })).toBeVisible();
  await choose(page, d, '缩放与显示', '首页');
  await expect(d.getByText('第 1 / 10 页', { exact: true })).toBeVisible();
  await choose(page, d, '缩放与显示', '100%实际大小');
  await expect(d.getByRole('button', { name: '缩放与显示', exact: true })).toContainText('100%');
  await choose(page, d, '缩放与显示', '放大');
  await expect(d.getByRole('button', { name: '缩放与显示', exact: true })).toContainText('125%');
  await choose(page, d, '缩放与显示', '缩小');
  await expect(d.getByRole('button', { name: '缩放与显示', exact: true })).toContainText('100%');
  for (const action of ['向右旋转', '向左旋转', '适合宽度', '适合整页']) {
    await choose(page, d, '缩放与显示', action);
    await expect(d.getByRole('button', { name: '下一页', exact: true })).toBeEnabled();
    if (action === '向右旋转')
      await expect
        .poll(() =>
          frame
            .locator('canvas')
            .first()
            .evaluate(
              (canvas: HTMLCanvasElement) =>
                canvas.getBoundingClientRect().width > canvas.getBoundingClientRect().height,
            ),
        )
        .toBe(true);
    if (action === '向左旋转')
      await expect
        .poll(() =>
          frame
            .locator('canvas')
            .first()
            .evaluate(
              (canvas: HTMLCanvasElement) =>
                canvas.getBoundingClientRect().height > canvas.getBoundingClientRect().width,
            ),
        )
        .toBe(true);
  }
  await choose(page, d, '文档导航', '页面缩略图');
  const aside = d.getByRole('complementary', { name: '页面缩略图' });
  await expect(aside.locator('img')).toHaveCount(8);
  await expect(aside.getByRole('button', { name: '下一组缩略图', exact: true })).toBeEnabled();
  await aside.getByRole('button', { name: '下一组缩略图', exact: true }).click();
  await expect(aside.locator('img')).toHaveCount(2);
  await aside.getByRole('button', { name: '第 10 页', exact: true }).click();
  await expect(d.getByText('第 10 / 10 页', { exact: true })).toBeVisible();
  await choose(page, d, '文档导航', '文档大纲');
  await d.getByRole('button', { name: 'Chapter 3', exact: true }).click();
  await expect(d.getByText('第 3 / 10 页', { exact: true })).toBeVisible();
  await d.getByRole('button', { name: '返回上个文档位置', exact: true }).click();
  await expect(d.getByText('第 10 / 10 页', { exact: true })).toBeVisible();
  await d.getByRole('button', { name: '前进到下个文档位置', exact: true }).click();
  await expect(d.getByText('第 3 / 10 页', { exact: true })).toBeVisible();
  await choose(page, d, '文档导航', '收起侧栏');
  const third = frame.locator('.page[data-page-number="3"]');
  await third.locator('.annotationLayer a').first().click();
  await expect(d.getByText('第 10 / 10 页', { exact: true })).toBeVisible();
});
async function stampFixtures(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 60;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('创建标注样本需要 Canvas');
    context.fillStyle = '#e0009c';
    context.fillRect(0, 0, 60, 60);
    const png = canvas.toDataURL('image/png').split(',')[1] ?? '';
    const webp = canvas.toDataURL('image/webp').split(',')[1] ?? '';
    context.fillRect(0, 0, 120, 60);
    const jpeg = canvas.toDataURL('image/jpeg').split(',')[1] ?? '';
    canvas.width = 1025;
    canvas.height = 1;
    const wide = canvas.toDataURL('image/png').split(',')[1] ?? '';
    return { png, webp, jpeg, wide };
  });
}

async function chooseStamp(
  page: Page,
  dialog: ReturnType<Page['getByRole']>,
  name: string,
  buffer: Buffer,
  mimeType = 'image/png',
  button = '图片标注',
) {
  const pending = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: button, exact: true }).click();
  await (await pending).setFiles({ name, buffer, mimeType });
}

test('PDF 本机图片标注可跨页编辑、缩放、撤销并导出真实副本', async ({ page }, info) => {
  test.setTimeout(150_000);
  await openReadingFixtureFolder(page, 'pdf-stamp-');
  await page.setViewportSize({ width: 1440, height: 1000 });
  const parent = new URL(page.url()).searchParams.get('parent');
  const d = await upload(page, fixture('reader.pdf'));
  const sourceName = await d.getByRole('heading').innerText();
  const button = (name: string) => d.getByRole('button', { name, exact: true });
  const frame = d.frameLocator('iframe');
  const pageAt = (index: number) => frame.locator('.page[data-page-number="' + index + '"]');
  const stamps = (index: number) => pageAt(index).locator('.stampEditor');
  const { png, jpeg, webp, wide } = await stampFixtures(page);
  const sample = Buffer.from(png, 'base64');
  await expect(button('图片标注')).toBeEnabled();
  await choose(page, d, '缩放与显示', '适合整页');
  const canceled = page.waitForEvent('filechooser');
  await button('图片标注').click();
  await (await canceled).setFiles([]);
  await expect(stamps(1)).toHaveCount(0);
  await expect(button('导出标注副本')).toBeDisabled();
  for (const [name, content, message] of [
    ['bad.png', Buffer.from('invalid image'), /无法读取标注图片/],
    ['broken.png', sample.subarray(0, 35), /无法读取标注图片/],
    ['large.png', Buffer.concat([sample, Buffer.alloc(2 * 1024 * 1024)]), /超过 2 MiB/],
    ['wide.png', Buffer.from(wide, 'base64'), /每边最多 1024 像素/],
  ] as const) {
    await chooseStamp(page, d, name, content);
    await expect(d.getByRole('alert')).toHaveText(message);
    await expect(stamps(1)).toHaveCount(0);
  }
  await chooseStamp(page, d, 'overlay.png', sample);
  await expect(d.getByText('已在第 1 页添加图片标注。', { exact: true })).toBeVisible();
  await expect(d.locator('iframe')).toHaveAttribute('data-pdf-editor', 'stamp');
  const stamp = stamps(1).first();
  const artwork = stamp.locator('canvas');
  await expect(artwork).toBeVisible();
  const pixels = await artwork.evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法读取标注画布');
    const middle = Math.floor(canvas.height / 2);
    return [
      Array.from(context.getImageData(Math.floor(canvas.width * 0.25), middle, 1, 1).data),
      Array.from(context.getImageData(Math.floor(canvas.width * 0.75), middle, 1, 1).data),
    ];
  });
  expect(pixels).toEqual([
    [224, 0, 156, 255],
    [0, 0, 0, 0],
  ]);
  await expect(d.getByText('有未导出的标注', { exact: true })).toBeVisible();
  const box = await artwork.boundingBox();
  if (!box) throw new Error('缺少图片标注位置');
  expect(box.width / box.height).toBeCloseTo(2, 1);
  const drag = async (x: number, y: number, dx: number, dy: number) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
  };
  await drag(box.x + box.width * 0.25, box.y + box.height / 2, 24, 16);
  await expect.poll(async () => (await artwork.boundingBox())?.x).toBeGreaterThan(box.x + 10);
  const resizer = stamp.locator('.resizer.bottomRight');
  await expect(resizer).toBeVisible();
  const corner = await resizer.boundingBox();
  if (!corner) throw new Error('缺少图片缩放控件');
  await drag(corner.x + corner.width / 2, corner.y + corner.height / 2, 28, 14);
  await expect
    .poll(async () => (await artwork.boundingBox())?.width)
    .toBeGreaterThan(box.width + 12);
  const resized = await artwork.boundingBox();
  if (!resized) throw new Error('缩放后缺少图片标注位置');
  expect(resized.width / resized.height).toBeCloseTo(2, 1);

  await button('下一页').click();
  await expect(d.getByText('第 2 / 10 页', { exact: true })).toBeVisible();
  await expect(stamps(2)).toHaveCount(0);
  await chooseStamp(page, d, 'overlay.jpg', Buffer.from(jpeg, 'base64'), 'image/jpeg');
  await expect(d.getByText('已在第 2 页添加图片标注。', { exact: true })).toBeVisible();
  await chooseStamp(page, d, 'overlay.webp', Buffer.from(webp, 'base64'), 'image/webp');
  await expect(stamps(2).locator('canvas')).toHaveCount(2);
  const recent = stamps(2).last();
  await recent.click();
  await recent.getByRole('button', { name: '移除图像', exact: true }).click();
  await expect(stamps(2)).toHaveCount(1);
  await button('撤销标注').click();
  await expect(stamps(2)).toHaveCount(2);
  await button('重做标注').click();
  await expect(stamps(2)).toHaveCount(1);
  await button('上一页').click();
  await expect(d.getByText('第 1 / 10 页', { exact: true })).toBeVisible();
  await expect(stamps(1)).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('pdf-stamp-desktop.png'), animations: 'disabled' });
  await button('关闭').click();
  const discard = page.getByRole('dialog', { name: '丢弃未导出的标注？', exact: true });
  await discard.getByRole('button', { name: '继续阅读', exact: true }).click();
  await expect(stamps(1)).toHaveCount(1);

  const download = page.waitForEvent('download');
  await button('导出标注副本').click();
  const output = info.outputPath('stamp-annotated.pdf');
  await (await download).saveAs(output);
  expect((await readFile(output)).toString('latin1')).toContain('/Stamp');
  await expect(d.getByText('有未导出的标注', { exact: true })).toHaveCount(0);
  await button('关闭').click();
  const originalBytes = await page.evaluate(
    async ({ parent, sourceName }) => {
      const list = await fetch(
        '/api/console/v1/native/files?parent=' + encodeURIComponent(parent ?? ''),
      );
      if (!list.ok) throw new Error('无法读取测试目录');
      const { items } = (await list.json()) as { items: { id: string; name: string }[] };
      const original = items.find(({ name }) => name === sourceName);
      if (!original) throw new Error('无法找到原件');
      const response = await fetch(
        '/api/console/v1/native/files/' + encodeURIComponent(original.id) + '/content',
      );
      if (!response.ok) throw new Error('无法读取 PDF 原件');
      return Array.from(new Uint8Array(await response.arrayBuffer()));
    },
    { parent, sourceName },
  );
  expect(Buffer.from(originalBytes)).toEqual(await readFile(fixture('reader.pdf')));
  const reopened = await upload(page, output);
  const exported = reopened.frameLocator('iframe');
  await expect(exported.locator('.page[data-page-number="1"] .stampAnnotation')).toHaveCount(1);
  await reopened.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(exported.locator('.page[data-page-number="2"] .stampAnnotation')).toHaveCount(1);
});

test('PDF 图片读取可取消，窗口导入有界，窄屏英文仍可使用', async ({ page }, info) => {
  test.setTimeout(150_000);
  const d = await upload(page, fixture('reader.pdf'));
  const name = await d.getByRole('heading').innerText();
  const frame = d.frameLocator('iframe');
  const button = (label: string) => d.getByRole('button', { name: label, exact: true });
  const { png } = await stampFixtures(page);
  const sample = Buffer.from(png, 'base64');
  await expect(button('图片标注')).toBeEnabled();
  type StampProbe = { closed: number; release?: () => void };
  await page.evaluate(() => {
    const probe: StampProbe = { closed: 0 };
    Object.defineProperty(window, '__pdfStampProbe', { value: probe });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- 保留原生位图的 this。
    const close = ImageBitmap.prototype.close;
    ImageBitmap.prototype.close = function () {
      if (this.width === 120 && this.height === 60) probe.closed++;
      close.call(this);
    };
    let pauseNext = true;
    window.createImageBitmap = new Proxy(window.createImageBitmap.bind(window), {
      async apply(target, receiver: unknown, args: unknown[]) {
        const bitmap = await (Reflect.apply(target, receiver, args) as Promise<ImageBitmap>);
        if (pauseNext && bitmap.width === 120 && bitmap.height === 60) {
          pauseNext = false;
          await new Promise<void>((resolve) => {
            probe.release = resolve;
          });
        }
        return bitmap;
      },
    });
  });
  await chooseStamp(page, d, 'cancel.png', sample);
  await expect(button('下一页')).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as unknown as { __pdfStampProbe: StampProbe }).__pdfStampProbe.release),
      ),
    )
    .toBe(true);
  await button('取消读取图片').click();
  await page.evaluate(() =>
    (window as unknown as { __pdfStampProbe: StampProbe }).__pdfStampProbe.release?.(),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __pdfStampProbe: StampProbe }).__pdfStampProbe.closed,
      ),
    )
    .toBe(1);
  await expect(frame.locator('.stampEditor')).toHaveCount(0);
  const dropPrevented = await frame.locator('#viewerContainer').evaluate((element, bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([Uint8Array.from(bytes)], 'drop.png', { type: 'image/png' }));
    return !element.dispatchEvent(
      new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }),
    );
  }, Array.from(sample));
  expect(dropPrevented).toBe(true);
  await expect(frame.locator('.stampEditor')).toHaveCount(0);
  for (let index = 1; index <= 12; index++) {
    await chooseStamp(page, d, 'asset-' + index + '.png', sample);
    await expect(frame.locator('.stampEditor canvas')).toHaveCount(index);
  }
  await expect(button('图片标注')).toBeDisabled();
  await expect(d.getByText('本窗口最多导入 12 次图片标注。', { exact: true })).toBeVisible();
  await button('撤销标注').click();
  await expect(frame.locator('.stampEditor canvas')).toHaveCount(11);
  await expect(button('图片标注')).toBeDisabled();
  await button('关闭').click();
  await page.getByRole('button', { name: '丢弃并关闭', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByRole('button', { name, exact: true }).click();
  const reopened = page.getByRole('dialog', { name, exact: true });
  await chooseStamp(page, reopened, 'mobile.png', sample, 'image/png', 'Image annotation');
  await expect(
    reopened.getByText('Image annotation added on page 1.', { exact: true }),
  ).toBeVisible();
  await expect(reopened.frameLocator('iframe').locator('.stampEditor canvas')).toBeVisible();
  await page.screenshot({ path: info.outputPath('pdf-stamp-mobile.png'), animations: 'disabled' });
});

test('F279–280：真实文字批注、撤销重做、导出含批注副本再打开', async ({ page }, info) => {
  const d = await upload(page, fixture('reader.pdf'));
  const frame = d.frameLocator('iframe');
  await expect(frame.locator('canvas').first()).toBeVisible();
  await choose(page, d, '缩放与显示', '适合整页');
  await choose(page, d, '标注工具', '文字标注');
  await frame.locator('.page[data-page-number="1"]').click({ position: { x: 60, y: 80 } });
  const editor = frame.locator('.freeTextEditor [contenteditable="true"]').first();
  await expect(editor).toBeVisible();
  await editor.fill('PDF annotation acceptance');
  await choose(page, d, '标注工具', '阅读与选择');
  await expect(d.getByText('有未导出的标注', { exact: true })).toBeVisible();
  await expect(d.getByRole('button', { name: '撤销标注', exact: true })).toBeEnabled();
  await d.getByRole('button', { name: '撤销标注', exact: true }).click();
  await expect(d.getByRole('button', { name: '重做标注', exact: true })).toBeEnabled();
  await d.getByRole('button', { name: '重做标注', exact: true }).click();
  const download = page.waitForEvent('download');
  await d.getByRole('button', { name: '导出标注副本', exact: true }).click();
  const file = await download;
  const path = info.outputPath('annotated.pdf');
  await file.saveAs(path);
  const output = await readFile(path);
  expect(output.toString('latin1')).toContain('/FreeText');
  expect(output.toString('latin1')).toContain('PDF annotation acceptance');
  expect(output.equals(await readFile(fixture('reader.pdf')))).toBe(false);
  await expect(d.getByText('有未导出的标注', { exact: true })).toHaveCount(0);
  await d.getByRole('button', { name: '关闭', exact: true }).click();
  const reopened = await upload(page, path);
  await expect(reopened.frameLocator('iframe').locator('.freeTextAnnotation')).toContainText(
    'PDF annotation acceptance',
  );
});
test('F279：真实手绘和高亮批注，未导出关闭保护', async ({ page }, info) => {
  const d = await upload(page, fixture('reader.pdf')),
    frame = d.frameLocator('iframe');
  await expect(frame.locator('canvas').first()).toBeVisible();
  await choose(page, d, '缩放与显示', '适合整页');
  await choose(page, d, '标注工具', '手绘标注');
  const box = await frame.locator('.page[data-page-number="1"]').boundingBox();
  if (!box) throw new Error('缺少实际页面');
  await frame
    .locator('.page[data-page-number="1"]')
    .hover({ position: { x: box.width * 0.25, y: box.height * 0.4 } });
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45, { steps: 8 });
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  await choose(page, d, '标注工具', '阅读与选择');
  await expect(d.getByText('有未导出的标注', { exact: true })).toBeVisible();
  await choose(page, d, '缩放与显示', '100%实际大小');
  await choose(page, d, '标注工具', '高亮标注');
  const text = frame
    .locator('.textLayer span')
    .filter({ hasText: 'Alpha alpha ALPHA alphabet' })
    .first();
  await text.scrollIntoViewIfNeeded();
  await text.hover();
  const line = await text.boundingBox();
  if (!line) throw new Error('缺少真实文字层');
  await page.mouse.move(line.x + 2, line.y + line.height / 2);
  await page.mouse.down();
  await page.mouse.move(line.x + line.width - 2, line.y + line.height / 2, { steps: 12 });
  await page.mouse.up();
  await choose(page, d, '标注工具', '阅读与选择');
  const download = page.waitForEvent('download');
  await d.getByRole('button', { name: '导出标注副本', exact: true }).click();
  const file = await download;
  const output = await readFile(await file.path());
  expect(output.toString('latin1')).toContain('/Ink');
  expect(output.toString('latin1')).toContain('/Highlight');
  await file.saveAs(info.outputPath('ink-highlight.pdf'));
  await d.getByRole('button', { name: '撤销标注', exact: true }).click();
  await expect(d.getByText('有未导出的标注', { exact: true })).toBeVisible();
  await d.getByRole('button', { name: '关闭', exact: true }).click();
  const guard = page.getByRole('dialog', { name: '丢弃未导出的标注？', exact: true });
  await expect(guard).toBeVisible();
  await guard.getByRole('button', { name: '继续阅读', exact: true }).click();
  await expect(d).toBeVisible();
  await d.getByRole('button', { name: '关闭', exact: true }).click();
  await guard.getByRole('button', { name: '丢弃并关闭', exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
});
test('Worker加载失败明确报错，禁用假Worker回退', async ({ page }) => {
  await page.context().route('**/pdf.worker.min.mjs', (route) => route.abort());
  const d = await upload(page, fixture('reader.pdf'));
  await expect(d.getByRole('alert')).toContainText('阅读组件未能启动');
  await expect(d.locator('iframe')).toHaveAttribute('src', 'about:blank');
});
test('阅读器320px与深色视觉、资源按需加载和关闭释放', async ({ page }, info) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.reload();
  await expect(page.getByRole('button', { name: '新建', exact: true })).toBeVisible();
  expect(requests.filter((url) => url.includes('/file-viewers/pdf/'))).toHaveLength(0);
  await page.setViewportSize({ width: 320, height: 800 });
  const d = await upload(page, fixture('reader.pdf'));
  const frame = d.frameLocator('iframe');
  const name = await d.getByRole('heading').innerText();
  await expect(frame.locator('canvas').first()).toBeVisible();
  const rect = await d.locator('iframe').boundingBox();
  expect(rect?.width).toBeGreaterThan(100);
  expect(rect?.height).toBeGreaterThan(150);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('pdf-reader-mobile.png'), fullPage: false });
  await d.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect.poll(() => page.workers().length).toBe(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await page.getByRole('button', { name, exact: true }).click();
  await expect(d.getByText('Page 1 / 10', { exact: true })).toBeVisible();
  await expect(frame.locator('html')).toHaveAttribute('style', /color-scheme: dark/);
  await page.screenshot({
    path: info.outputPath('pdf-reader-dark-english-desktop.png'),
    fullPage: false,
  });
  await expect(page.locator('[role=log] [role=img]')).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.screenshot({
    path: info.outputPath('pdf-reader-dark-english-mobile.png'),
    fullPage: false,
  });
  await d.getByRole('button', { name: 'Close', exact: true }).click();
});

test('历史PDF按明确revision读取，当前已换成加密PDF仍可打开原版', async ({ page }) => {
  const d = await upload(page, fixture('reader.pdf'));
  const name = await d.getByRole('heading').innerText();
  await expect(d.getByText('第 1 / 10 页', { exact: true })).toBeVisible();
  await d.getByRole('button', { name: '关闭', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: name + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '上传新版本', exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: 'replacement.pdf',
    mimeType: 'application/pdf',
    buffer: await readFile(fixture('encrypted.pdf')),
  });
  const queue = page.getByRole('dialog', { name: '上传队列', exact: true });
  if (!(await queue.isVisible())) await page.getByRole('button', { name: /^上传队列/ }).click();
  await expect(queue.getByText('上传完成', { exact: true })).toBeVisible();
  await queue.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: name + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '版本历史', exact: true }).click();
  await expect(
    page.locator('[data-file-version="2"]').getByText('当前版本', { exact: true }),
  ).toBeVisible();
  await page
    .locator('[data-file-version="1"]')
    .getByRole('button', { name: '预览此版本', exact: true })
    .click();
  const pdf = page.getByRole('dialog', { name, exact: true });
  await expect(pdf.getByText('第 1 / 10 页', { exact: true })).toBeVisible();
  await expect(pdf.frameLocator('iframe').locator('canvas').first()).toBeVisible();
  await expect(pdf.getByText('此PDF需要密码。', { exact: true })).toHaveCount(0);
});
test('真实图像解码：4MP正常显示，9MP按可见预算说明省略', async ({ page }) => {
  for (const [file, omitted] of [
    ['under-image.pdf', false],
    ['over-image.pdf', true],
  ] as const) {
    const d = await upload(page, fixture(file));
    await expect(d.getByRole('button', { name: '跳转', exact: true })).toBeEnabled();
    await expect(d.getByText(/单张图像最多.*8,388,608.*超限图像不显示/)).toBeVisible();
    const pixel = await d
      .frameLocator('iframe')
      .locator('canvas')
      .first()
      .evaluate((canvas: HTMLCanvasElement) => {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('缺少实际画布');
        return [
          ...context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1)
            .data,
        ];
      });
    expect(pixel.slice(0, 3)).toEqual(omitted ? [255, 255, 255] : [255, 0, 0]);
    await d.getByRole('button', { name: '关闭', exact: true }).click();
  }
});
test('后台上传刷新文件列表不重开阅读会话或丢弃临时批注', async ({ page }) => {
  const parent = new URL(page.url()).searchParams.get('parent');
  const first = await upload(page, fixture('reader.pdf')),
    name = await first.getByRole('heading').innerText();
  await expect(first.getByRole('button', { name: '跳转', exact: true })).toBeEnabled();
  await first.getByRole('button', { name: '关闭', exact: true }).click();
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const pattern = '**/native/files/transfers/*/data';
  const backgroundName = 'background-' + Date.now() + '.txt';
  await page.route(pattern, async (route) => {
    if (route.request().method() === 'PATCH') await gate;
    await route.continue();
  });
  try {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '新建', exact: true }).click();
    await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: backgroundName,
      mimeType: 'text/plain',
      buffer: Buffer.from('background upload'),
    });
    const queue = page.getByRole('dialog', { name: '上传队列', exact: true });
    await expect(queue.getByText('上传中', { exact: true })).toBeVisible();
    await queue.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
    const d = page.getByRole('dialog', { name, exact: true }),
      frame = d.frameLocator('iframe');
    await expect(d.getByRole('button', { name: '跳转', exact: true })).toBeEnabled();
    await choose(page, d, '缩放与显示', '适合整页');
    await choose(page, d, '标注工具', '文字标注');
    await frame.locator('.page[data-page-number="1"]').click({ position: { x: 60, y: 80 } });
    await frame
      .locator('.freeTextEditor [contenteditable="true"]')
      .first()
      .fill('Keep draft after background refresh');
    await choose(page, d, '标注工具', '阅读与选择');
    await expect(d.getByText('有未导出的标注', { exact: true })).toBeVisible();
    const document = frame.locator('html');
    await document.evaluate((node) => node.setAttribute('data-test-reader-session', 'retained'));
    const refreshed = page.waitForResponse(async (response) => {
      const url = new URL(response.url());
      if (
        url.pathname !== '/api/console/v1/native/files' ||
        url.searchParams.get('parent') !== parent ||
        url.searchParams.get('pagination') !== 'auto' ||
        response.request().method() !== 'GET' ||
        response.status() !== 200
      )
        return false;
      const listing = (await response.json()) as { items: { name: string }[] };
      return listing.items.some(({ name: listedName }) => listedName === backgroundName);
    });
    release();
    await refreshed;
    await expect(document).toHaveAttribute('data-test-reader-session', 'retained');
    await expect(d.getByText('有未导出的标注', { exact: true })).toBeVisible();
    // 阅读模式会卸下编辑层，切回后检查同一会话保有的实际文字。
    await choose(page, d, '标注工具', '文字标注');
    await expect(frame.locator('.page[data-page-number="1"] .freeTextEditor')).toContainText(
      'Keep draft after background refresh',
    );
    await expect(d.getByText('有未导出的标注', { exact: true })).toBeVisible();
    await d.getByRole('button', { name: '关闭', exact: true }).click();
    await page
      .getByRole('dialog', { name: '丢弃未导出的标注？', exact: true })
      .getByRole('button', { name: '丢弃并关闭', exact: true })
      .click();
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});
