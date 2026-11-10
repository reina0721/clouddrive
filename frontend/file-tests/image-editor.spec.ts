import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function createWorkspace(page: Page, prefix = 'image-editor-') {
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
  const parentId = await page.evaluate(async (folderPrefix) => {
    const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
    const response = await fetch('/api/console/v1/native/files/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
      body: JSON.stringify({ parentId: '', name: folderPrefix + crypto.randomUUID() }),
    });
    if (!response.ok) throw new Error('创建独立测试目录失败');
    return ((await response.json()) as { id: string }).id;
  }, prefix);
  await page.goto('/home?parent=' + parentId);
  await page.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('menuitem', { name: '列表', exact: true }).click();
  return parentId;
}

async function uploadFixtures(page: Page, topLeftColor = '#ff0000') {
  const images = await page.evaluate((topLeftColor) => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器不支持 Canvas');
    // 四个象限区分颜色、位置和透明度，调色用例使用未饱和的左上色块。
    for (const [color, x, y] of [
      [topLeftColor, 0, 0],
      ['#00ff00', 160, 0],
      ['#0000ff', 0, 120],
    ] as const) {
      context.fillStyle = color;
      context.fillRect(x, y, 160, 120);
    }
    const source = canvas.toDataURL('image/png').split(',')[1] ?? '';
    const webp = canvas.toDataURL('image/webp').split(',')[1] ?? '';
    canvas.width = 8193;
    canvas.height = 1;
    const large = canvas.toDataURL('image/png').split(',')[1] ?? '';
    return { source, webp, large };
  }, topLeftColor);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  await (
    await chooser
  ).setFiles([
    { name: 'source.png', mimeType: 'image/png', buffer: Buffer.from(images.source, 'base64') },
    {
      name: 'source.webp',
      mimeType: 'image/webp',
      buffer: Buffer.from(images.webp, 'base64'),
    },
    { name: 'oversize.png', mimeType: 'image/png', buffer: Buffer.from(images.large, 'base64') },
  ]);
  const queue = page.getByRole('dialog', { name: '上传队列', exact: true });
  await expect(queue.getByText('上传完成', { exact: true })).toHaveCount(3);
  await queue.getByRole('button', { name: '关闭', exact: true }).click();
  return images;
}

async function topLeft(canvas: Locator) {
  return canvas.evaluate((element: HTMLCanvasElement) => {
    const context = element.getContext('2d');
    if (!context) throw new Error('画布读取失败');
    return Array.from(context.getImageData(2, 2, 1, 1).data);
  });
}

async function canvasPixel(canvas: Locator, x: number, y: number) {
  return canvas.evaluate(
    (node: HTMLCanvasElement, point) => {
      const context = node.getContext('2d');
      if (!context) throw new Error('画布读取失败');
      return Array.from(
        context.getImageData(
          Math.round(point.x * node.width),
          Math.round(point.y * node.height),
          1,
          1,
        ).data,
      );
    },
    { x, y },
  );
}

async function copyPixel(page: Page, content: Buffer, type: string, x: number, y: number) {
  return page.evaluate(
    async ({ bytes, type, x, y }) => {
      const image = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type }));
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('副本画布读取失败');
        context.drawImage(image, 0, 0);
        return {
          size: [image.width, image.height],
          pixel: Array.from(context.getImageData(x, y, 1, 1).data),
        };
      } finally {
        image.close();
      }
    },
    { bytes: Array.from(content), type, x, y },
  );
}

async function downloadCopy(page: Page, editor: Locator, expectedName: string) {
  const pending = page.waitForEvent('download');
  await editor.getByRole('button', { name: '下载副本', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe(expectedName);
  const path = await download.path();
  if (!path) throw new Error('没有收到下载文件');
  return readFile(path);
}

async function imageAnnotationWorkspace(page: Page) {
  const parent = await createWorkspace(page, 'image-overlays-');
  await uploadFixtures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'source.png', exact: true }).click();
  await page.getByRole('button', { name: '编辑图片', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '图片编辑器', exact: true });
  const button = (name: string) => editor.getByRole('button', { name, exact: true });
  const canvas = editor.getByRole('img', { name: '图片编辑画布', exact: true });
  const field = (name: string) =>
    editor
      .locator('[data-slot="select-trigger"]')
      .and(editor.getByRole('button', { name: new RegExp(name) }));
  const choose = async (name: string, option: string) => {
    await field(name).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  const chooseImage = async (name: string, buffer: Buffer, mimeType = 'image/png') => {
    const pending = page.waitForEvent('filechooser');
    await button('图片').click();
    await (await pending).setFiles({ name, buffer, mimeType });
  };
  const assets = await page.evaluate(() => {
    const sample = document.createElement('canvas');
    sample.width = 80;
    sample.height = 40;
    const context = sample.getContext('2d');
    if (!context) throw new Error('创建标注素材需要 Canvas');
    context.fillStyle = '#f0cc20';
    context.fillRect(0, 0, 40, 40);
    const png = sample.toDataURL('image/png').split(',')[1] ?? '';
    context.fillStyle = '#e000a0';
    context.fillRect(0, 0, 80, 40);
    const jpeg = sample.toDataURL('image/jpeg').split(',')[1] ?? '';
    const webp = sample.toDataURL('image/webp').split(',')[1] ?? '';
    sample.width = 1025;
    sample.height = 1;
    const oversized = sample.toDataURL('image/png').split(',')[1] ?? '';
    return { png, jpeg, webp, oversized };
  });
  await button('图片标注').click();
  await expect(
    editor
      .getByRole('group', { name: '标注工具' })
      .getByRole('button', { name: '图片', exact: true }),
  ).toBeVisible();
  return { parent, editor, canvas, button, field, choose, chooseImage, assets };
}

test('图片标注可合成透明素材、编辑叠放顺序并保存真实新版本', async ({ page }, info) => {
  test.setTimeout(150_000);
  const { parent, editor, canvas, button, field, choose, chooseImage, assets } =
    await imageAnnotationWorkspace(page);
  const png = Buffer.from(assets.png, 'base64');
  const gold = [240, 204, 32, 255];
  const pixel = (x: number, y: number) => canvasPixel(canvas, x / 320, y / 240);
  const pointer = async (x: number, y: number, endX = x, endY = y) => {
    await canvas.scrollIntoViewIfNeeded();
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('没有可操作的标注画布');
    await page.mouse.move(
      bounds.x + (bounds.width * x) / 320,
      bounds.y + (bounds.height * y) / 240,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + (bounds.width * endX) / 320,
      bounds.y + (bounds.height * endY) / 240,
      { steps: 4 },
    );
    await page.mouse.up();
  };

  for (const [name, buffer, message] of [
    ['invalid.png', Buffer.from('invalid image'), /无法读取这张标注图片/],
    ['corrupt.png', png.subarray(0, 35), /无法读取这张标注图片/],
    ['large.png', Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]), /超过 2 MiB/],
    ['wide.png', Buffer.from(assets.oversized, 'base64'), /每边最多 1024 像素/],
  ] as const) {
    await chooseImage(name, buffer);
    await expect(editor.getByRole('alert')).toHaveText(message);
    await expect(field('选中标注')).toContainText('未选中');
  }

  await chooseImage('overlay.png', png);
  await expect(field('选中标注')).toContainText('图片 #1');
  await expect(editor.getByText('overlay.png', { exact: true })).toBeVisible();
  await expect.poll(() => pixel(135, 128)).toEqual(gold);
  await expect.poll(() => pixel(180, 130)).toEqual([0, 0, 0, 0]);
  await expect.poll(() => pixel(100, 100)).toEqual([255, 0, 0, 255]);
  await choose('标注图片大小', '50%');
  await expect.poll(() => pixel(100, 100)).toEqual(gold);
  await choose('标注图片旋转', '90°');
  await expect.poll(() => pixel(162, 70)).toEqual(gold);
  await choose('不透明度', '50%');
  await expect.poll(async () => (await pixel(162, 70))[0]).toBeGreaterThan(110);
  await expect.poll(async () => (await pixel(162, 70))[0]).toBeLessThan(130);
  await pointer(160, 120, 210, 150);
  await expect.poll(async () => (await pixel(218, 130))[3]).toBe(128);
  await expect.poll(() => pixel(162, 70)).toEqual([0, 255, 0, 255]);
  await button('复制选中图片').click();
  await expect(field('选中标注')).toContainText('图片 #2');
  await choose('不透明度', '100%');
  await pointer(218, 130);
  await expect(field('选中标注')).toContainText('图片 #2');
  await choose('选中标注', '图片 #1');
  await expect(field('不透明度')).toContainText('50%');
  await choose('选中标注', '图片 #2');
  await expect(field('不透明度')).toContainText('100%');
  await expect(button('前移一层')).toBeDisabled();

  await button('矩形').click();
  await choose('标注颜色', '黑色');
  await editor.getByRole('checkbox', { name: '填充形状', exact: true }).press('Space');
  await pointer(200, 106, 235, 146);
  await expect.poll(() => pixel(218, 130)).toEqual([0, 0, 0, 255]);
  await choose('选中标注', '图片 #2');
  await button('前移一层').click();
  await expect.poll(() => pixel(218, 130)).toEqual(gold);
  await button('后移一层').click();
  await expect.poll(() => pixel(218, 130)).toEqual([0, 0, 0, 255]);
  await button('前移一层').click();
  await button('删除选中标注').click();
  await expect.poll(() => pixel(218, 130)).toEqual([0, 0, 0, 255]);
  await button('撤销').click();
  await expect.poll(() => pixel(218, 130)).toEqual(gold);
  await button('重做').click();
  await expect.poll(() => pixel(218, 130)).toEqual([0, 0, 0, 255]);
  await button('撤销').click();
  await button('清除全部标注').click();
  await expect.poll(() => pixel(218, 130)).toEqual([0, 0, 0, 0]);
  await button('撤销').click();
  await expect.poll(() => pixel(218, 130)).toEqual(gold);

  await chooseImage('overlay.jpg', Buffer.from(assets.jpeg, 'base64'), 'image/jpeg');
  await expect(editor.getByText('overlay.jpg', { exact: true })).toBeVisible();
  await expect.poll(async () => (await pixel(143, 132))[0]).toBeGreaterThan(215);
  await expect.poll(async () => (await pixel(143, 132))[2]).toBeGreaterThan(130);
  await button('删除选中标注').click();
  await chooseImage('overlay.webp', Buffer.from(assets.webp, 'base64'), 'image/webp');
  await expect(editor.getByText('overlay.webp', { exact: true })).toBeVisible();
  await expect.poll(async () => (await pixel(143, 132))[2]).toBeGreaterThan(130);
  await button('删除选中标注').click();
  await choose('选中标注', '图片 #2');
  await canvas.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath('image-annotation-desktop.png'),
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 760 });
  await canvas.scrollIntoViewIfNeeded();
  expect((await canvas.boundingBox())?.width).toBeLessThan(390);
  await page.screenshot({
    path: info.outputPath('image-annotation-mobile.png'),
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1440, height: 900 });

  await editor.getByLabel('副本名称（不含扩展名）').fill('overlay-copy');
  const copy = await downloadCopy(page, editor, 'overlay-copy.png');
  expect(await copyPixel(page, copy, 'image/png', 218, 130)).toEqual({
    size: [320, 240],
    pixel: gold,
  });
  expect((await copyPixel(page, copy, 'image/png', 154, 170)).pixel).toEqual([0, 0, 255, 255]);
  await button('保存为新版本').click();
  await page
    .getByRole('dialog', { name: '确认保存新版本' })
    .getByRole('button', { name: '保存新版本', exact: true })
    .click();
  await expect(page.getByText('已保存图片新版本。', { exact: true })).toBeVisible();
  const published = await page.evaluate(async (parentId) => {
    const listing = await fetch(
      '/api/console/v1/native/files?parent=' + encodeURIComponent(parentId),
    );
    if (!listing.ok) throw new Error('无法读取标注测试目录');
    const { items } = (await listing.json()) as {
      items: { id: string; name: string; contentRevision: number }[];
    };
    const source = items.find(({ name }) => name === 'source.png');
    if (!source) throw new Error('未找到已发布图片');
    const response = await fetch(
      '/api/console/v1/native/files/' + encodeURIComponent(source.id) + '/content',
    );
    if (!response.ok) throw new Error('无法读取已发布图片内容');
    return {
      revision: source.contentRevision,
      bytes: Array.from(new Uint8Array(await response.arrayBuffer())),
    };
  }, parent);
  expect(published.revision).toBe(2);
  expect(Buffer.from(published.bytes)).toEqual(copy);
});

test('图片标注取消读取、限制历史位图数量并释放淘汰素材', async ({ page }) => {
  test.setTimeout(120_000);
  const { editor, button, field, chooseImage, assets } = await imageAnnotationWorkspace(page);
  const png = Buffer.from(assets.png, 'base64');
  type OverlayProbe = { closed: number; resume?: () => void };
  await page.evaluate(() => {
    const probe: OverlayProbe = { closed: 0 };
    Object.defineProperty(window, '__annotationOverlayProbe', { value: probe });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- 调用时保留原位图的 this。
    const close = ImageBitmap.prototype.close;
    ImageBitmap.prototype.close = function () {
      if (this.width === 80 && this.height === 40) probe.closed++;
      close.call(this);
    };
    let pauseNext = true;
    window.createImageBitmap = new Proxy(window.createImageBitmap.bind(window), {
      async apply(target, receiver: unknown, args: unknown[]) {
        const bitmap = await (Reflect.apply(target, receiver, args) as Promise<ImageBitmap>);
        if (pauseNext && bitmap.width === 80 && bitmap.height === 40) {
          pauseNext = false;
          await new Promise<void>((resolve) => {
            probe.resume = resolve;
          });
        }
        return bitmap;
      },
    });
  });
  const closed = () =>
    page.evaluate(
      () =>
        (window as unknown as { __annotationOverlayProbe: OverlayProbe }).__annotationOverlayProbe
          .closed,
    );
  await chooseImage('cancel.png', png);
  await expect(button('下载副本')).toBeDisabled();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (window as unknown as { __annotationOverlayProbe: OverlayProbe }).__annotationOverlayProbe
            .resume,
        ),
      ),
    )
    .toBe(true);
  await button('取消读取图片').click();
  await page.evaluate(() =>
    (
      window as unknown as { __annotationOverlayProbe: OverlayProbe }
    ).__annotationOverlayProbe.resume?.(),
  );
  await expect.poll(closed).toBe(1);
  await expect(field('选中标注')).toContainText('未选中');
  for (let index = 1; index <= 12; index++) {
    await chooseImage('asset-' + index + '.png', png);
    await expect(field('选中标注')).toContainText('图片 #' + index);
  }
  await expect(button('图片')).toBeDisabled();
  await expect(editor.getByText('编辑历史最多保留 12 张不同的标注图片。')).toBeVisible();
  await button('复制选中图片').click();
  await expect(field('选中标注')).toContainText('图片 #13');
  await button('撤销').click();
  await expect(button('图片')).toBeDisabled();
  await button('撤销').click();
  await expect(button('图片')).toBeEnabled();
  await chooseImage('replacement.png', png);
  await expect(editor.getByText('replacement.png', { exact: true })).toBeVisible();
  await expect.poll(closed).toBe(2);
  await expect(button('重做')).toBeDisabled();
  await button('关闭').click();
  await expect.poll(closed).toBe(14);
});

test('图片按原版本保存并可将过期草稿另存到指定目录', async ({ page }, info) => {
  test.setTimeout(180_000);
  const root = await createWorkspace(page, 'image-save-');
  const { source } = await uploadFixtures(page, '#60789c');
  const folder = await page.evaluate(async (parentId) => {
    const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
    const response = await fetch('/api/console/v1/native/files/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
      body: JSON.stringify({ parentId, name: '图片副本目录' }),
    });
    if (!response.ok) throw new Error('创建副本目录失败，状态码 ' + response.status);
    return ((await response.json()) as { id: string }).id;
  }, root);
  type ListedFile = { id: string; name: string; mediaType: string; contentRevision: number };
  const listing = (owner: Page, parent: string) =>
    owner.evaluate(async (id) => {
      const response = await fetch('/api/console/v1/native/files?parent=' + encodeURIComponent(id));
      if (!response.ok) throw new Error('无法读取目录，状态码 ' + response.status);
      return ((await response.json()) as { items: ListedFile[] }).items;
    }, parent);
  const sourceEntry = (await listing(page, root)).find(({ name }) => name === 'source.png');
  if (!sourceEntry) throw new Error('没有原图片');
  const openEditor = async (owner: Page) => {
    await owner.getByRole('button', { name: 'source.png', exact: true }).click();
    await owner.getByRole('button', { name: '编辑图片', exact: true }).click();
    return owner.getByRole('dialog', { name: '图片编辑器', exact: true });
  };
  await page.setViewportSize({ width: 1440, height: 900 });
  const editor = await openEditor(page);
  const button = (name: string) => editor.getByRole('button', { name, exact: true });
  const version = button('保存为新版本');
  const confirm = page.getByRole('dialog', { name: '确认保存新版本', exact: true });
  const chooseFormat = async (format: string) => {
    await editor
      .locator('[data-slot="select-trigger"]')
      .and(editor.getByRole('button', { name: /输出格式/ }))
      .click();
    await page.getByRole('option', { name: format, exact: true }).click();
  };

  await expect(version).toBeDisabled();
  await expect(button('上传副本到原文件夹')).toBeEnabled();
  await expect(editor.getByText('副本保存位置 · 原文件夹', { exact: true })).toBeVisible();
  await button('裁剪').click();
  await expect(version).toBeDisabled();
  await button('旋转和翻转').click();
  await button('向右旋转').click();
  await button('色彩微调').click();
  await editor.getByRole('slider', { name: '亮度', exact: true }).press('End');
  await expect(version).toBeDisabled();
  await button('取消外观调整').click();
  await expect(version).toBeEnabled();
  await chooseFormat('WebP');
  await expect(version).toBeDisabled();
  await expect(editor.getByText('请选择与原文件一致的格式才能保存新版本。')).toBeVisible();
  await chooseFormat('PNG');
  await button('旋转和翻转').click();
  await version.click();
  await expect(confirm.getByText('source.png', { exact: true })).toBeVisible();
  await expect(confirm.getByText('编辑所依据的版本 · 1', { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('image-save-desktop.png'),
    animations: 'disabled',
  });
  await confirm.getByRole('button', { name: '取消', exact: true }).click();
  expect((await listing(page, root)).find(({ id }) => id === sourceEntry.id)?.contentRevision).toBe(
    1,
  );

  const stalePage = await page.context().newPage();
  await stalePage.setViewportSize({ width: 1440, height: 900 });
  await stalePage.goto('/home?parent=' + root);
  const stale = await openEditor(stalePage);
  const staleButton = (name: string) => stale.getByRole('button', { name, exact: true });
  await staleButton('水平翻转').click();
  const staleCanvas = stale.getByRole('img', { name: '图片编辑画布', exact: true });
  await expect.poll(() => topLeft(staleCanvas)).toEqual([0, 255, 0, 255]);

  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let continued = () => {};
  const forwarded = new Promise<void>((resolve) => {
    continued = resolve;
  });
  let waiting = false;
  const commitPath = '**/native/files/transfers/*/commit';
  await page.route(commitPath, async (route) => {
    waiting = true;
    await gate;
    try {
      await route.continue();
    } finally {
      continued();
    }
  });
  try {
    await version.click();
    await confirm.getByRole('button', { name: '保存新版本', exact: true }).click();
    await expect.poll(() => waiting).toBe(true);
    await expect(confirm.getByText('保存新版本…', { exact: true })).toBeVisible();
    await expect(page.getByText('已保存图片新版本。', { exact: true })).toHaveCount(0);
    expect(
      (await listing(page, root)).find(({ id }) => id === sourceEntry.id)?.contentRevision,
    ).toBe(1);
  } finally {
    release();
    if (waiting) await forwarded;
    await page.unroute(commitPath);
  }
  await expect(editor).toHaveCount(0);
  await expect(page.getByText('已保存图片新版本。', { exact: true })).toBeVisible();
  const refreshed = page.getByRole('dialog').getByRole('img', { name: 'source.png', exact: true });
  await expect
    .poll(() =>
      refreshed.evaluate((image: HTMLImageElement) => [image.naturalWidth, image.naturalHeight]),
    )
    .toEqual([240, 320]);
  const updated = (await listing(page, root)).find(({ name }) => name === 'source.png');
  expect(updated).toMatchObject({
    id: sourceEntry.id,
    name: 'source.png',
    mediaType: 'image/png',
    contentRevision: 2,
  });
  const originalVersion = () =>
    page.evaluate(async (id) => {
      const response = await fetch(
        '/api/console/v1/native/files/' + encodeURIComponent(id) + '/versions/1/content',
      );
      if (response.status === 429) return null;
      if (!response.ok) throw new Error('无法读取旧版本，状态码 ' + response.status);
      return btoa(String.fromCharCode(...new Uint8Array(await response.arrayBuffer())));
    }, sourceEntry.id);
  await expect.poll(originalVersion, { intervals: [500, 1000, 2500] }).toBe(source);

  await staleButton('保存为新版本').click();
  await stalePage
    .getByRole('dialog', { name: '确认保存新版本', exact: true })
    .getByRole('button', { name: '保存新版本', exact: true })
    .click();
  await expect(stale.getByRole('alert')).toHaveText('原文件已变更，当前草稿可以另存为副本。');
  await expect(staleButton('保存为新版本')).toBeDisabled();
  await expect.poll(() => topLeft(staleCanvas)).toEqual([0, 255, 0, 255]);
  await staleButton('更改副本保存位置').click();
  const picker = stalePage.getByRole('dialog', { name: '选择副本保存位置', exact: true });
  await picker.getByRole('button', { name: '进入 图片副本目录', exact: true }).click();
  await picker.getByRole('button', { name: '上一级', exact: true }).click();
  await picker.getByRole('button', { name: '进入 图片副本目录', exact: true }).click();
  await stalePage.setViewportSize({ width: 390, height: 760 });
  await expect(picker.getByRole('button', { name: '使用此位置', exact: true })).toBeEnabled();
  await stalePage.screenshot({
    path: info.outputPath('image-save-mobile.png'),
    animations: 'disabled',
  });
  await picker.getByRole('button', { name: '使用此位置', exact: true }).click();
  await expect(stale.getByText(/副本保存位置.*图片副本目录/)).toBeVisible();

  await staleButton('更改副本保存位置').click();
  await picker.getByRole('button', { name: '我的文件', exact: true }).click();
  await expect(picker.getByRole('button', { name: '上一级', exact: true })).toHaveCount(0);
  await picker.getByRole('button', { name: '取消', exact: true }).click();
  await expect(stale.getByText(/副本保存位置.*图片副本目录/)).toBeVisible();
  await stalePage.setViewportSize({ width: 1440, height: 900 });
  await stale.getByLabel('副本名称（不含扩展名）').fill('saved-from-stale');
  const downloaded = await downloadCopy(stalePage, stale, 'saved-from-stale.png');
  expect(await copyPixel(stalePage, downloaded, 'image/png', 2, 2)).toEqual({
    size: [320, 240],
    pixel: [0, 255, 0, 255],
  });
  await staleButton('上传副本到所选位置').click();
  await expect
    .poll(async () => (await listing(stalePage, folder)).map(({ name }) => name))
    .toContain('saved-from-stale.png');
  expect((await listing(stalePage, root)).map(({ name }) => name)).not.toContain(
    'saved-from-stale.png',
  );

  const sameName = stalePage.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/native/files/transfers') &&
      (response.request().postDataJSON() as { name?: string } | null)?.name ===
        'saved-from-stale.png',
  );
  await staleButton('上传副本到所选位置').click();
  expect((await sameName).status()).toBe(409);
  const copies = (await listing(stalePage, folder)).filter(
    ({ name }) => name === 'saved-from-stale.png',
  );
  expect(copies).toHaveLength(1);
  expect(copies[0]?.contentRevision).toBe(1);
  expect((await listing(page, root)).find(({ id }) => id === sourceEntry.id)?.contentRevision).toBe(
    2,
  );
  await stalePage.close();
});

test('图片编辑器支持视图缩放、原图对比及独立导出质量', async ({ page }, info) => {
  test.setTimeout(150_000);
  await createWorkspace(page, 'image-viewport-');
  await uploadFixtures(page, '#60789c');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'source.png', exact: true }).click();
  await page.getByRole('button', { name: '编辑图片', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '图片编辑器', exact: true });
  const button = (name: string) => editor.getByRole('button', { name, exact: true });
  const canvas = editor.getByRole('img', { name: '图片编辑画布', exact: true });
  const viewport = editor.getByRole('region', { name: '画布视区', exact: true });
  const exportRegion = editor.getByRole('region', { name: '导出设置', exact: true });
  const zoom = button('画布缩放');
  const chooseZoom = async (label: string) => {
    await zoom.click();
    await page.getByRole('menuitem', { name: label, exact: true }).click();
  };
  const canvasDimensions = () =>
    canvas.evaluate((node: HTMLCanvasElement) => [
      node.clientWidth,
      node.clientHeight,
      node.width,
      node.height,
    ]);
  const scrollPosition = () =>
    viewport.evaluate((node) => ({ x: node.scrollLeft, y: node.scrollTop }));
  const choose = async (field: string, option: string) => {
    await editor
      .locator('[data-slot="select-trigger"]')
      .and(editor.getByRole('button', { name: new RegExp(field) }))
      .click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  const draw = async (from: [number, number], to: [number, number]) => {
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('找不到图片画布');
    const point = ([x, y]: [number, number]) =>
      [bounds.x + x * bounds.width, bounds.y + y * bounds.height] as const;
    await page.mouse.move(...point(from));
    await page.mouse.down();
    await page.mouse.move(...point(to), { steps: 4 });
    await page.mouse.up();
  };
  await expect.poll(async () => (await canvasDimensions())[2]).toBe(1200);
  const wideFit = Math.round(((await canvasDimensions())[0]! * 100) / 320);
  await expect(zoom).toHaveText(wideFit + '%');
  await expect(button('拖动画布')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 760 });
  await expect.poll(async () => (await canvasDimensions())[0]).toBeLessThan(390);
  // 窄屏切换后弹窗仍在过渡，按当前画布宽度验证观察器发布的比例。
  await expect
    .poll(async () => {
      const narrowFit = Math.round(((await canvasDimensions())[0]! * 100) / 320);
      return narrowFit < wideFit && (await zoom.textContent()) === narrowFit + '%';
    })
    .toBe(true);
  await page.screenshot({ path: info.outputPath('viewport-mobile.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 900 });

  await chooseZoom('实际尺寸 (100%)');
  await expect.poll(canvasDimensions).toEqual([320, 240, 320, 240]);
  await button('放大画布').click();
  await expect(zoom).toHaveText('150%');
  await button('缩小画布').click();
  await expect(zoom).toHaveText('100%');
  await chooseZoom('50%');
  await expect.poll(canvasDimensions).toEqual([160, 120, 160, 120]);
  await chooseZoom('400%');
  await expect.poll(canvasDimensions).toEqual([1280, 960, 320, 240]);
  await expect(button('放大画布')).toBeDisabled();
  await button('拖动画布').click();
  await viewport.scrollIntoViewIfNeeded();
  const initial = await scrollPosition();
  const area = await viewport.boundingBox();
  if (!area) throw new Error('找不到画布视区');
  await page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
  await page.mouse.down();
  await page.mouse.move(area.x + area.width / 2 - 80, area.y + area.height / 2 - 55, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await scrollPosition()).x).toBeGreaterThan(initial.x);
  await expect.poll(async () => (await scrollPosition()).y).toBeGreaterThan(initial.y);
  await button('结束拖动画布').click();
  const beforeKey = await scrollPosition();
  await viewport.focus();
  await viewport.press('ArrowLeft');
  await expect.poll(async () => (await scrollPosition()).x).toBeLessThan(beforeKey.x);
  await chooseZoom('适合窗口');
  await expect(zoom).toHaveText(wideFit + '%');
  await expect(button('撤销')).toBeDisabled();
  await page.screenshot({ path: info.outputPath('viewport-desktop.png'), animations: 'disabled' });

  await chooseZoom('200%');
  await button('裁剪').click();
  await expect(zoom).toHaveText('200%');
  await viewport.scrollIntoViewIfNeeded();
  await draw([30 / 320, 40 / 240], [210 / 320, 180 / 240]);
  await expect(editor.getByLabel('裁剪起点 X')).toHaveValue('30');
  await expect(editor.getByLabel('裁剪起点 Y')).toHaveValue('40');
  await expect(editor.getByLabel('宽度（像素）')).toHaveValue('180');
  await expect(editor.getByLabel('高度（像素）')).toHaveValue('140');
  await button('应用裁剪').click();
  await expect.poll(canvasDimensions).toEqual([360, 280, 180, 140]);

  await button('图片标注').click();
  await expect(zoom).toHaveText('200%');
  await button('矩形').click();
  await choose('标注颜色', '黑色');
  const fill = editor.getByRole('checkbox', { name: '填充形状', exact: true });
  if (!(await fill.isChecked())) await fill.press('Space');
  await viewport.scrollIntoViewIfNeeded();
  await draw([0.08, 0.1], [0.28, 0.32]);
  await expect.poll(() => canvasPixel(canvas, 0.18, 0.2)).toEqual([0, 0, 0, 255]);

  await button('色彩微调').click();
  await editor.getByRole('slider', { name: '亮度', exact: true }).press('End');
  await expect.poll(() => canvasPixel(canvas, 0.4, 0.2)).toEqual([160, 184, 220, 255]);
  await button('查看原图').click();
  await expect(editor.getByText('320 × 240 px', { exact: true })).toBeVisible();
  await expect.poll(() => canvasPixel(canvas, 0.18, 0.2)).toEqual([96, 120, 156, 255]);
  await button('返回编辑预览').click();
  await expect(editor.getByText('180 × 140 px', { exact: true })).toBeVisible();
  await expect.poll(() => canvasPixel(canvas, 0.4, 0.2)).toEqual([160, 184, 220, 255]);
  await button('应用外观调整').click();
  await button('查看原图').click();
  await button('导出设置').click();
  await expect(exportRegion).toBeFocused();
  await exportRegion.getByLabel('副本名称（不含扩展名）').fill('viewport-copy');
  await page.evaluate(() => {
    const calls: Array<{ format: string | undefined; quality: number | undefined }> = [];
    Object.defineProperty(window, '__imageEncodingCalls', { value: calls });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- 保持原编码器的 this 并记录实参。
    const encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, format, quality) {
      calls.push({ format, quality });
      return encode.call(this, callback, format, quality);
    };
  });
  const quality = exportRegion.getByRole('slider', { name: '压缩质量', exact: true });
  await expect(quality).toHaveCount(0);
  const png = await downloadCopy(page, editor, 'viewport-copy.png');
  const result = await copyPixel(page, png, 'image/png', 165, 125);
  expect(result).toEqual({ size: [180, 140], pixel: [0, 0, 0, 0] });

  for (const [format, extension] of [
    ['JPEG', 'jpg'],
    ['WebP', 'webp'],
  ] as const) {
    await choose('输出格式', format);
    await quality.press('Home');
    await expect(exportRegion.getByText('10%', { exact: true })).toBeVisible();
    const low = await downloadCopy(page, editor, 'viewport-copy.' + extension);
    await quality.press('End');
    await expect(exportRegion.getByText('100%', { exact: true })).toBeVisible();
    const high = await downloadCopy(page, editor, 'viewport-copy.' + extension);
    expect(high.equals(low)).toBe(false);
    const mime = format === 'JPEG' ? 'image/jpeg' : 'image/webp';
    expect((await copyPixel(page, high, mime, 80, 60)).size).toEqual([180, 140]);
  }
  await page.screenshot({ path: info.outputPath('viewport-export.png'), animations: 'disabled' });
  await choose('输出格式', 'PNG');
  await expect(quality).toHaveCount(0);
  expect(await downloadCopy(page, editor, 'viewport-copy.png')).toEqual(png);
  const calls = await page.evaluate(
    () =>
      (
        window as unknown as {
          __imageEncodingCalls: Array<{ format: string; quality?: number }>;
        }
      ).__imageEncodingCalls,
  );
  expect(calls).toEqual([
    { format: 'image/png', quality: undefined },
    { format: 'image/jpeg', quality: 0.1 },
    { format: 'image/jpeg', quality: 1 },
    { format: 'image/webp', quality: 0.1 },
    { format: 'image/webp', quality: 1 },
    { format: 'image/png', quality: undefined },
  ]);
});

test('WebP 支持图片水印、透明副本和原件保留', async ({ page }, info) => {
  test.setTimeout(150_000);
  const parentId = await createWorkspace(page, 'image-logo-');
  const { webp: original } = await uploadFixtures(page);
  const assets = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('创建水印样本需要 Canvas');
    ctx.fillStyle = '#f0cc20';
    ctx.fillRect(0, 0, 40, 40);
    const png = canvas.toDataURL('image/png').split(',')[1] ?? '';
    const webp = canvas.toDataURL('image/webp').split(',')[1] ?? '';
    ctx.fillStyle = '#e000a0';
    ctx.fillRect(0, 0, 80, 40);
    const jpeg = canvas.toDataURL('image/jpeg').split(',')[1] ?? '';
    canvas.width = 1025;
    canvas.height = 1;
    const oversized = canvas.toDataURL('image/png').split(',')[1] ?? '';
    return { png, webp, jpeg, oversized };
  });
  await page.evaluate(() => {
    const probe = { closed: 0 };
    Object.defineProperty(window, '__logoCloseProbe', { value: probe });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- 调用时保留原位图的 this。
    const close = ImageBitmap.prototype.close;
    ImageBitmap.prototype.close = function () {
      if (this.width === 80 && this.height === 40) probe.closed++;
      close.call(this);
    };
  });
  const closed = () =>
    page.evaluate(
      () => (window as unknown as { __logoCloseProbe: { closed: number } }).__logoCloseProbe.closed,
    );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'source.webp', exact: true }).click();
  await expect(page.getByRole('img', { name: 'source.webp', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑图片', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '图片编辑器', exact: true });
  const button = (name: string) => editor.getByRole('button', { name, exact: true });
  const canvas = editor.getByRole('img', { name: '图片编辑画布', exact: true });
  const slider = (name: string) => editor.getByRole('slider', { name, exact: true });
  const pixel = (x: number, y: number) => canvasPixel(canvas, x / 320, y / 240);
  const select = (field: string) =>
    editor
      .locator('[data-slot="select-trigger"]')
      .and(editor.getByRole('button', { name: new RegExp(field) }));
  const choose = async (field: string, option: string) => {
    await select(field).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  const chooseFile = async (name: string, mimeType: string, buffer: Buffer) => {
    const pending = page.waitForEvent('filechooser');
    await editor.getByRole('button', { name: /^(选择|替换)水印图片$/ }).click();
    await (await pending).setFiles({ name, mimeType, buffer });
  };
  const pngLogo = Buffer.from(assets.png, 'base64');
  const isGold = ([r = 0, g = 0, b = 0, a = 0]: number[]) =>
    r > 200 && g > 150 && b < 90 && a > 240;
  await expect(select('输出格式')).toContainText('WebP');
  await expect.poll(() => pixel(280, 220)).toEqual([0, 0, 0, 0]);
  const originalAtTop = await pixel(20, 20);
  await button('水印').click();
  await expect(button('文字水印')).toBeVisible();
  await button('图片水印').click();
  await chooseFile('brand.png', 'image/png', pngLogo);
  await expect(editor.getByText('brand.png', { exact: true })).toBeVisible();
  await expect(button('下载副本')).toBeDisabled();
  await slider('图片水印不透明度').press('End');

  for (const [option, x, y] of [
    ['左上', 24, 24],
    ['上方居中', 145, 24],
    ['右上', 266, 24],
    ['左侧居中', 24, 120],
    ['中央', 145, 120],
    ['右侧居中', 266, 120],
    ['左下', 24, 216],
    ['下方居中', 145, 216],
    ['右下', 266, 216],
  ] as const) {
    await choose('图片水印位置', option);
    await expect.poll(async () => isGold(await pixel(x, y))).toBe(true);
  }
  await expect.poll(() => pixel(299, 216)).toEqual([0, 0, 0, 0]);
  await slider('图片水印不透明度').press('Home');
  await expect.poll(async () => (await pixel(266, 216))[3]).toBeLessThan(20);
  await slider('图片水印不透明度').press('End');
  await choose('图片水印位置', '左上');
  const pastLogoHeight = await pixel(20, 43);
  await slider('图片水印尺寸').press('Home');
  await expect.poll(() => pixel(20, 20)).toEqual(originalAtTop);
  for (let index = 0; index < 4; index++) await slider('图片水印尺寸').press('ArrowRight');
  await expect.poll(async () => isGold(await pixel(20, 20))).toBe(true);
  await expect.poll(() => pixel(20, 43)).toEqual(pastLogoHeight);

  for (const [name, buffer, message] of [
    [
      'not-a-logo.png',
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      /无法读取这张水印/,
    ],
    ['broken.png', pngLogo.subarray(0, 35), /无法读取这张水印/],
    ['too-many-bytes.png', Buffer.concat([pngLogo, Buffer.alloc(2 * 1024 * 1024)]), /超过 2 MiB/],
    ['too-wide.png', Buffer.from(assets.oversized, 'base64'), /每边最多 1024 像素/],
  ] as const) {
    await chooseFile(name, 'image/png', buffer);
    await expect(editor.getByRole('alert')).toHaveText(message);
    await expect(editor.getByText('brand.png', { exact: true })).toBeVisible();
    await expect.poll(async () => isGold(await pixel(20, 20))).toBe(true);
  }
  await button('应用外观调整').click();
  await chooseFile('brand.jpg', 'image/jpeg', Buffer.from(assets.jpeg, 'base64'));
  await expect(editor.getByText('brand.jpg', { exact: true })).toBeVisible();
  await expect.poll(async () => (await pixel(20, 20))[2]).toBeGreaterThan(120);
  await button('取消外观调整').click();
  await expect.poll(closed).toBe(1);
  await expect.poll(async () => isGold(await pixel(20, 20))).toBe(true);
  await chooseFile('brand.webp', 'image/webp', Buffer.from(assets.webp, 'base64'));
  await expect(editor.getByText('brand.webp', { exact: true })).toBeVisible();
  await button('应用外观调整').click();
  await button('撤销').click();
  await expect(editor.getByText('brand.png', { exact: true })).toBeVisible();
  await button('重做').click();
  await expect(editor.getByText('brand.webp', { exact: true })).toBeVisible();
  await button('移除图片水印').click();
  await expect.poll(() => pixel(20, 20)).toEqual(originalAtTop);
  await button('应用外观调整').click();
  await button('撤销').click();
  await expect.poll(async () => isGold(await pixel(20, 20))).toBe(true);

  await button('文字水印').click();
  await editor.getByLabel('水印文字', { exact: true }).fill('CD');
  await button('应用外观调整').click();
  await button('图片水印').click();
  const textVisible = () =>
    canvas.evaluate((node: HTMLCanvasElement) => {
      const context = node.getContext('2d');
      if (!context) throw new Error('无法读取文字水印');
      const data = context.getImageData(
        node.width * 0.75,
        node.height * 0.75,
        node.width * 0.25,
        node.height * 0.25,
      ).data;
      return data.some(
        (red, index) =>
          index % 4 === 0 &&
          red > 240 &&
          data[index + 1] > 240 &&
          data[index + 2] > 240 &&
          data[index + 3] > 120,
      );
    });
  await expect.poll(textVisible).toBe(true);
  await expect.poll(async () => isGold(await pixel(20, 20))).toBe(true);

  await page.screenshot({ path: info.outputPath('logo-desktop.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 760 });
  await canvas.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath('logo-mobile-canvas.png'),
    animations: 'disabled',
  });
  await button('替换水印图片').scrollIntoViewIfNeeded();
  expect((await canvas.boundingBox())!.width).toBeLessThan(390);
  await page.screenshot({ path: info.outputPath('logo-mobile.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 900 });

  await editor.getByLabel('副本名称（不含扩展名）').fill('logo-copy');
  const webpCopy = await downloadCopy(page, editor, 'logo-copy.webp');
  expect(webpCopy.toString('ascii', 0, 4)).toBe('RIFF');
  expect(webpCopy.toString('ascii', 8, 12)).toBe('WEBP');
  expect((await copyPixel(page, webpCopy, 'image/webp', 220, 180)).pixel[3]).toBe(0);
  expect(isGold((await copyPixel(page, webpCopy, 'image/webp', 20, 20)).pixel)).toBe(true);
  await button('上传副本到原文件夹').click();
  await expect(editor.getByRole('status')).toContainText('副本已加入上传队列');
  await choose('输出格式', 'PNG');
  const png = await downloadCopy(page, editor, 'logo-copy.png');
  expect(isGold((await copyPixel(page, png, 'image/png', 20, 20)).pixel)).toBe(true);
  expect((await copyPixel(page, png, 'image/png', 220, 180)).pixel).toEqual([0, 0, 0, 0]);
  await choose('输出格式', 'JPEG');
  const jpeg = await downloadCopy(page, editor, 'logo-copy.jpg');
  expect(isGold((await copyPixel(page, jpeg, 'image/jpeg', 20, 20)).pixel)).toBe(true);
  expect((await copyPixel(page, jpeg, 'image/jpeg', 220, 180)).pixel).toEqual([255, 255, 255, 255]);

  await button('关闭').click();
  await expect.poll(closed).toBe(3);
  const names = ['source.webp', 'logo-copy.webp'];
  for (const [name, base64] of [
    [names[0], original],
    [names[1], webpCopy.toString('base64')],
  ] as const) {
    await expect
      .poll(
        () =>
          page.evaluate(
            async ({ id, name }) => {
              const listing = await fetch(
                '/api/console/v1/native/files?parent=' + encodeURIComponent(id),
              );
              if (!listing.ok) throw new Error('无法读取副本目录，状态码 ' + listing.status);
              const { items } = (await listing.json()) as {
                items: { id: string; name: string; contentRevision: number }[];
              };
              const entry = items.find((item) => item.name === name);
              if (!entry) return null;
              const response = await fetch(
                '/api/console/v1/native/files/' + encodeURIComponent(entry.id) + '/content',
              );
              if (response.status === 429) return null;
              if (!response.ok) throw new Error('无法读取副本内容，状态码 ' + response.status);
              return {
                contentRevision: entry.contentRevision,
                bytes: btoa(String.fromCharCode(...new Uint8Array(await response.arrayBuffer()))),
              };
            },
            { id: parentId, name },
          ),
        { intervals: [500, 1000, 2500], timeout: 25_000 },
      )
      .toEqual({ contentRevision: 1, bytes: base64 });
  }
});

test('图片外观调整支持色彩、滤镜、文字水印和副本导出', async ({ page }, info) => {
  test.setTimeout(120_000);
  await createWorkspace(page, 'image-appearance-');
  await uploadFixtures(page, '#60789c');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'source.png', exact: true }).click();
  await page.getByRole('button', { name: '编辑图片', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '图片编辑器', exact: true });
  const button = (name: string) => editor.getByRole('button', { name, exact: true });
  const slider = (name: string) => editor.getByRole('slider', { name, exact: true });
  const canvas = editor.getByRole('img', { name: '图片编辑画布', exact: true });
  const pixel = () => canvasPixel(canvas, 0.25, 0.25);
  const original = [96, 120, 156, 255];
  const choose = async (field: string, option: string) => {
    await editor
      .locator('[data-slot="select-trigger"]')
      .and(editor.getByRole('button', { name: new RegExp(field) }))
      .click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };

  await button('色彩微调').click();
  await expect.poll(pixel).toEqual(original);
  for (const [field, key, expected] of [
    ['亮度', 'End', [160, 184, 220, 255]],
    ['对比度', 'End', [64, 112, 184, 255]],
    ['饱和度', 'Home', [117, 117, 117, 255]],
    ['色相', 'End', [139, 115, 79, 255]],
    ['色温', 'End', [131, 120, 121, 255]],
    ['曝光', 'ArrowRight', [103, 129, 167, 255]],
  ] as const) {
    await slider(field).press(key);
    await expect.poll(pixel).toEqual(expected);
    await expect(button('下载副本')).toBeDisabled();
    await button('重置色彩微调').click();
    await expect.poll(pixel).toEqual(original);
  }
  await slider('亮度').press('ArrowRight');
  const compare = editor.getByRole('checkbox', { name: '查看原色对比' });
  await compare.press('Space');
  await expect(compare).toBeChecked();
  await expect.poll(pixel).toEqual(original);
  await button('应用外观调整').click();
  await expect(button('下载副本')).toBeEnabled();
  await compare.press('Space');
  await expect(compare).not.toBeChecked();
  await expect.poll(pixel).toEqual([99, 123, 159, 255]);
  await button('重置色彩微调').click();
  await button('取消外观调整').click();
  await expect.poll(pixel).toEqual([99, 123, 159, 255]);
  await button('重置色彩微调').click();
  await button('应用外观调整').click();

  await button('滤镜').click();
  const filters = editor.getByRole('group', { name: '滤镜预设' });
  const seen = new Set([original.join(',')]);
  await expect(filters.locator('canvas')).toHaveCount(6);
  for (const name of ['黑白', '棕褐', '鲜艳', '柔和', '冷调']) {
    const filter = filters.getByRole('button', { name, exact: true });
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => seen.has((await pixel()).join(','))).toBe(false);
    seen.add((await pixel()).join(','));
  }
  const fullFilter = await pixel();
  await slider('滤镜强度').press('Home');
  await expect.poll(pixel).toEqual(original);
  await slider('滤镜强度').press('End');
  await expect.poll(pixel).toEqual(fullFilter);
  await button('应用外观调整').click();
  await filters.getByRole('button', { name: '原色', exact: true }).click();
  await expect.poll(pixel).toEqual(original);
  await button('应用外观调整').click();
  await button('撤销').click();
  await expect.poll(pixel).toEqual(fullFilter);
  await button('重做').click();
  await expect.poll(pixel).toEqual(original);
  await filters.getByRole('button', { name: '棕褐', exact: true }).click();
  await button('应用外观调整').click();
  const sepia = [159, 142, 111, 255];
  await expect.poll(pixel).toEqual(sepia);
  await page.screenshot({ path: info.outputPath('appearance-filters.png') });

  const goldPixels = () =>
    canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext('2d');
      if (!context) throw new Error('无法读取水印像素');
      const width = element.width;
      const height = Math.floor(element.height / 2);
      const pixels = context.getImageData(0, 0, width, height).data;
      let left = 0;
      let right = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index] > 220 && pixels[index + 1] > 170 && pixels[index + 2] < 50) {
          if ((index / 4) % width < width / 2) left++;
          else right++;
        }
      }
      return { left, right };
    });
  await button('水印').click();
  await editor.getByLabel('水印文字', { exact: true }).fill('CD');
  await choose('水印位置', '左上');
  await choose('水印颜色', '金色');
  await slider('水印不透明度').press('End');
  await slider('水印字号比例').press('Home');
  await expect.poll(async () => (await goldPixels()).left).toBeGreaterThan(0);
  const small = (await goldPixels()).left;
  await slider('水印字号比例').press('End');
  await expect.poll(async () => (await goldPixels()).left).toBeGreaterThan(small);
  await slider('水印不透明度').press('Home');
  await expect.poll(goldPixels).toEqual({ left: 0, right: 0 });
  await slider('水印不透明度').press('End');
  await choose('水印颜色', '白色');
  await expect.poll(goldPixels).toEqual({ left: 0, right: 0 });
  await choose('水印颜色', '金色');
  await choose('水印位置', '右上');
  await expect.poll(async () => (await goldPixels()).right).toBeGreaterThan(small);
  expect((await goldPixels()).left).toBe(0);
  await expect(button('上传副本到原文件夹')).toBeDisabled();
  await button('应用外观调整').click();
  await button('移除水印').click();
  await button('应用外观调整').click();
  await expect.poll(goldPixels).toEqual({ left: 0, right: 0 });
  await button('撤销').click();
  await expect.poll(async () => (await goldPixels()).right).toBeGreaterThan(small);
  await page.screenshot({ path: info.outputPath('appearance-desktop.png') });
  await page.setViewportSize({ width: 390, height: 760 });
  await canvas.scrollIntoViewIfNeeded();
  expect((await canvas.boundingBox())!.width).toBeLessThan(390);
  await page.screenshot({ path: info.outputPath('appearance-mobile.png') });
  await slider('水印不透明度').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('appearance-mobile-controls.png') });
  await page.setViewportSize({ width: 1440, height: 900 });

  await editor.getByLabel('副本名称（不含扩展名）').fill('appearance-copy');
  const png = await downloadCopy(page, editor, 'appearance-copy.png');
  expect(await copyPixel(page, png, 'image/png', 80, 60)).toEqual({
    size: [320, 240],
    pixel: sepia,
  });
  expect((await copyPixel(page, png, 'image/png', 240, 180)).pixel).toEqual([0, 0, 0, 0]);
  const exported = await page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(
      new Blob([Uint8Array.from(bytes)], { type: 'image/png' }),
    );
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法读取导出的水印');
      context.drawImage(bitmap, 0, 0);
      const rgba = context.getImageData(160, 0, 160, 120).data;
      return rgba.some(
        (red, index) =>
          index % 4 === 0 && red === 255 && rgba[index + 1] === 215 && rgba[index + 2] === 0,
      );
    } finally {
      bitmap.close();
    }
  }, Array.from(png));
  expect(exported).toBe(true);
  await choose('输出格式', 'JPEG');
  const jpeg = await downloadCopy(page, editor, 'appearance-copy.jpg');
  const white = (await copyPixel(page, jpeg, 'image/jpeg', 240, 180)).pixel;
  expect(white).toEqual([255, 255, 255, 255]);
});

test('本人图片标注支持图形、样式、历史和带标注副本', async ({ page }, info) => {
  test.setTimeout(120_000);
  const parent = await createWorkspace(page, 'image-annotations-');
  await uploadFixtures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'source.png', exact: true }).click();
  await page.getByRole('button', { name: '编辑图片', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '图片编辑器', exact: true });
  const button = (name: string) => editor.getByRole('button', { name, exact: true });
  const canvas = editor.getByRole('img', { name: '图片编辑画布', exact: true });
  const selectField = (field: string) =>
    editor
      .locator('[data-slot="select-trigger"]')
      .and(editor.getByRole('button', { name: new RegExp(field) }));
  const choose = async (field: string, option: string) => {
    await selectField(field).click();
    await page.getByRole('option', { name: option, exact: true }).click();
  };
  const pointer = async (points: readonly (readonly [number, number])[]) => {
    await canvas.scrollIntoViewIfNeeded();
    const area = await canvas.boundingBox();
    if (!area) throw new Error('找不到标注画布');
    const position = ([x, y]: readonly [number, number]) => ({
      x: area.x + (area.width * x) / 320,
      y: area.y + (area.height * y) / 240,
    });
    const [first, ...rest] = points;
    if (!first) throw new Error('找不到标注起点');
    const start = position(first);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (const point of rest) {
      const end = position(point);
      await page.mouse.move(end.x, end.y, { steps: 3 });
    }
    await page.mouse.up();
  };
  const pixel = (x: number, y: number) => canvasPixel(canvas, x / 320, y / 240);
  const blueChannel = async (x: number, y: number) => (await pixel(x, y))[2] ?? 0;
  await button('图片标注').click();
  await expect(editor.getByRole('group', { name: '标注工具' })).toBeVisible();
  await choose('标注颜色', '蓝色');
  await choose('线宽', '8');
  await choose('不透明度', '50%');
  const fill = editor.getByRole('checkbox', { name: '填充形状', exact: true });
  await fill.press('Space');
  await expect(fill).toBeChecked();
  await pointer([
    [20, 20],
    [110, 90],
  ]);
  await expect.poll(() => blueChannel(60, 50)).toBeGreaterThan(95);
  await expect.poll(async () => (await pixel(60, 50))[0]).toBeGreaterThan(140);
  await expect.poll(() => blueChannel(60, 17)).toBeGreaterThan(85);

  await button('椭圆').click();
  await choose('标注颜色', '金色');
  await choose('不透明度', '100%');
  await fill.press('Space');
  await expect(fill).not.toBeChecked();
  await pointer([
    [176, 20],
    [276, 88],
  ]);
  await expect.poll(() => pixel(226, 54)).toEqual([0, 255, 0, 255]);
  await choose('选中标注', '椭圆 #2');
  await fill.press('Space');
  await expect.poll(() => pixel(226, 54)).toEqual([255, 215, 0, 255]);
  await button('直线').click();
  await choose('标注颜色', '绿色');
  await pointer([
    [20, 108],
    [108, 108],
  ]);
  await expect.poll(() => pixel(62, 108)).toEqual([46, 139, 87, 255]);
  await button('箭头').click();
  await choose('标注颜色', '红色');
  await pointer([
    [24, 144],
    [108, 144],
  ]);
  await expect.poll(() => pixel(70, 144)).toEqual([255, 0, 0, 255]);
  await button('画笔').click();
  await choose('标注颜色', '白色');
  await pointer([
    [178, 164],
    [211, 199],
    [257, 169],
  ]);
  await expect.poll(() => pixel(211, 199)).toEqual([255, 255, 255, 255]);

  await button('多边形').click();
  await choose('标注颜色', '黑色');
  await fill.press('Space');
  await pointer([[216, 196]]);
  await expect(button('完成多边形')).toBeDisabled();
  await expect(button('下载副本')).toBeDisabled();
  await button('取消多边形').click();
  await expect(button('下载副本')).toBeEnabled();
  await pointer([[216, 196]]);
  await pointer([[300, 196]]);
  await pointer([[280, 234]]);
  await button('完成多边形').click();
  await expect.poll(() => pixel(266, 209)).toEqual([0, 0, 0, 255]);
  await button('文字').click();
  await choose('标注颜色', '白色');
  await editor.getByLabel('标注文字', { exact: true }).fill('Draft');
  await pointer([[22, 186]]);
  await choose('选中标注', '文字 #7');
  await expect(editor.getByLabel('标注文字', { exact: true })).toHaveValue('Draft');
  await choose('文字大小', '32');
  await editor.getByLabel('标注文字', { exact: true }).fill('Checked');
  await expect(button('下载副本')).toBeDisabled();
  await button('应用文字').click();
  await expect(editor.getByLabel('标注文字', { exact: true })).toHaveValue('Checked');

  await button('选择').click();
  await pointer([
    [60, 50],
    [95, 66],
  ]);
  await expect(selectField('选中标注')).toContainText('矩形 #1');
  await expect.poll(() => pixel(30, 35)).toEqual([255, 0, 0, 255]);
  await expect.poll(() => blueChannel(95, 66)).toBeGreaterThan(95);
  await choose('选中标注', '箭头 #4');
  await button('删除选中标注').click();
  await expect.poll(() => pixel(70, 144)).toEqual([0, 0, 255, 255]);
  await button('撤销').click();
  await expect.poll(() => pixel(70, 144)).toEqual([255, 0, 0, 255]);
  await button('重做').click();
  await expect.poll(() => pixel(70, 144)).toEqual([0, 0, 255, 255]);
  await button('撤销').click();
  await button('清除全部标注').click();
  await expect.poll(() => pixel(266, 209)).toEqual([0, 0, 0, 0]);
  await button('撤销').click();
  await expect.poll(() => pixel(266, 209)).toEqual([0, 0, 0, 255]);
  await button('撤销').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('annotations-desktop.png') });

  await page.setViewportSize({ width: 390, height: 760 });
  await canvas.scrollIntoViewIfNeeded();
  expect((await canvas.boundingBox())!.width).toBeLessThan(390);
  await page.screenshot({ path: info.outputPath('annotations-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await button('旋转和翻转').click();
  await button('向右旋转').click();
  await expect(editor.getByText('240 × 320 px')).toBeVisible();
  await expect
    .poll(async () => (await canvasPixel(canvas, 174 / 240, 95 / 320))[2])
    .toBeGreaterThan(95);
  await button('裁剪').click();
  await editor.getByLabel('裁剪起点 X').fill('40');
  await editor.getByLabel('裁剪起点 Y').fill('40');
  await editor.getByLabel('宽度（像素）').fill('140');
  await editor.getByLabel('高度（像素）').fill('90');
  await button('应用裁剪').click();
  await expect(editor.getByText('90 × 140 px')).toBeVisible();
  await expect
    .poll(async () => (await canvasPixel(canvas, 64 / 90, 55 / 140))[2])
    .toBeGreaterThan(95);
  await editor.getByLabel('副本名称（不含扩展名）').fill('annotated-copy');
  const png = await downloadCopy(page, editor, 'annotated-copy.png');
  const pngResult = await copyPixel(page, png, 'image/png', 64, 55);
  expect(pngResult.size).toEqual([90, 140]);
  expect(pngResult.pixel[2]).toBeGreaterThan(95);
  await button('上传副本到原文件夹').click();
  await expect
    .poll(() =>
      page.evaluate(async (id) => {
        const response = await fetch(
          '/api/console/v1/native/files?parent=' + encodeURIComponent(id),
        );
        if (!response.ok) return [];
        const listing = (await response.json()) as { items: { name: string }[] };
        return listing.items.map((entry) => entry.name);
      }, parent),
    )
    .toContain('annotated-copy.png');
  const copyId = await page.evaluate(async (id) => {
    const response = await fetch('/api/console/v1/native/files?parent=' + encodeURIComponent(id));
    if (!response.ok) throw new Error('未取得已上传副本，状态码 ' + response.status);
    const { items } = (await response.json()) as { items: { id: string; name: string }[] };
    return items.find(({ name }) => name === 'annotated-copy.png')?.id;
  }, parent);
  if (!copyId) throw new Error('未找到已上传副本');
  await expect
    .poll(
      () =>
        page.evaluate(async (id) => {
          const response = await fetch(
            '/api/console/v1/native/files/' + encodeURIComponent(id) + '/content',
          );
          if (response.status === 429) return null;
          if (!response.ok) throw new Error('未取得副本内容，状态码 ' + response.status);
          return Array.from(new Uint8Array(await response.arrayBuffer()));
        }, copyId),
      { intervals: [500, 1000, 2500], timeout: 30_000 },
    )
    .toEqual(Array.from(png));
  await choose('输出格式', 'JPEG');
  const jpeg = await downloadCopy(page, editor, 'annotated-copy.jpg');
  const jpegResult = await copyPixel(page, jpeg, 'image/jpeg', 64, 55);
  expect(jpegResult.size).toEqual([90, 140]);
  expect(jpegResult.pixel[2]).toBeGreaterThan(90);
});

test('本人图片可裁剪、变换、调整尺寸、下载与上传独立副本', async ({ page, browser }, info) => {
  const parentId = await createWorkspace(page);
  const { source: original } = await uploadFixtures(page);
  const preview = page.getByRole('dialog');
  const editor = page.getByRole('dialog', { name: '图片编辑器', exact: true });
  const button = (name: string) => editor.getByRole('button', { name, exact: true });
  const canvas = editor.getByRole('img', { name: '图片编辑画布', exact: true });
  const editEntry = () => page.getByRole('button', { name: '编辑图片', exact: true }).click();

  await page.getByRole('button', { name: 'oversize.png', exact: true }).click();
  await editEntry();
  await expect(editor.getByRole('alert')).toContainText('图片尺寸超出编辑上限');
  await expect(canvas).toHaveCount(0);
  await button('关闭').click();
  await preview.getByRole('button', { name: '关闭', exact: true }).click();

  await page.evaluate(() => {
    const count = { closed: 0 };
    Object.defineProperty(window, '__imageBitmapProbe', { value: count });
    // eslint-disable-next-line @typescript-eslint/unbound-method -- 记录释放次数后通过 call 传回原位图。
    const close = ImageBitmap.prototype.close;
    ImageBitmap.prototype.close = function () {
      count.closed++;
      close.call(this);
    };
  });
  await page.getByRole('button', { name: 'source.png', exact: true }).click();
  await editEntry();
  await expect(canvas).toBeVisible();
  await expect.poll(() => topLeft(canvas)).toEqual([255, 0, 0, 255]);
  await expect(button('撤销')).toBeDisabled();
  await button('向右旋转').click();
  await expect(editor.getByText('240 × 320 px')).toBeVisible();
  await expect.poll(() => topLeft(canvas)).toEqual([0, 0, 255, 255]);
  await button('向左旋转').click();
  await expect(editor.getByText('320 × 240 px')).toBeVisible();
  await expect.poll(() => topLeft(canvas)).toEqual([255, 0, 0, 255]);
  await button('水平翻转').click();
  await expect.poll(() => topLeft(canvas)).toEqual([0, 255, 0, 255]);
  await button('垂直翻转').click();
  await expect.poll(() => topLeft(canvas)).toEqual([0, 0, 0, 0]);
  await button('撤销').click();
  await expect.poll(() => topLeft(canvas)).toEqual([0, 255, 0, 255]);
  await button('重做').click();
  await expect.poll(() => topLeft(canvas)).toEqual([0, 0, 0, 0]);
  await button('恢复原图').click();
  await expect.poll(() => topLeft(canvas)).toEqual([255, 0, 0, 255]);

  await button('裁剪').click();
  await expect(button('下载副本')).toBeDisabled();
  await button('1:1').click();
  await expect(editor.getByLabel('裁剪起点 X')).toHaveValue('40');
  await expect(editor.getByLabel('宽度（像素）')).toHaveValue('240');
  await editor.getByLabel('裁剪起点 X').fill('321');
  await expect(button('应用裁剪')).toBeDisabled();
  await editor.getByLabel('裁剪起点 X').fill('160');
  await editor.getByLabel('裁剪起点 Y').fill('0');
  await editor.getByLabel('宽度（像素）').fill('160');
  await editor.getByLabel('高度（像素）').fill('120');
  await button('应用裁剪').click();
  await expect(editor.getByText('160 × 120 px')).toBeVisible();
  await expect.poll(() => topLeft(canvas)).toEqual([0, 255, 0, 255]);

  await button('裁剪').click();
  await canvas.scrollIntoViewIfNeeded();
  const area = await canvas.boundingBox();
  if (!area) throw new Error('找不到裁剪画布');
  await page.mouse.move(area.x + area.width / 4, area.y + area.height / 4);
  await page.mouse.down();
  await page.mouse.move(area.x + (area.width * 3) / 4, area.y + (area.height * 3) / 4, {
    steps: 4,
  });
  await page.mouse.up();
  await expect(editor.getByLabel('裁剪起点 X')).toHaveValue('80');
  await expect(editor.getByLabel('裁剪起点 Y')).toHaveValue('60');
  await expect(editor.getByLabel('宽度（像素）')).toHaveValue('160');
  await button('撤销').scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('image-editor-desktop.png') });
  await button('应用裁剪').click();

  await button('调整尺寸').click();
  await editor.getByLabel('宽度（像素）').fill('80');
  await expect(editor.getByLabel('高度（像素）')).toHaveValue('60');
  const aspect = editor.getByRole('checkbox', { name: '保持宽高比' });
  await aspect.press('Space');
  await expect(aspect).not.toBeChecked();
  await editor.getByLabel('高度（像素）').fill('9000');
  await expect(button('应用尺寸')).toBeDisabled();
  await editor.getByLabel('高度（像素）').fill('90');
  await button('应用尺寸').click();
  await expect(editor.getByText('80 × 90 px')).toBeVisible();
  await button('撤销').click();
  await expect(editor.getByText('160 × 120 px')).toBeVisible();
  await button('重做').click();
  await expect(editor.getByText('80 × 90 px')).toBeVisible();

  const name = editor.getByLabel('副本名称（不含扩展名）', { exact: true });
  await name.fill('../invalid');
  await expect(button('下载副本')).toBeDisabled();
  await name.fill('edited-copy');
  const png = await downloadCopy(page, editor, 'edited-copy.png');
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([80, 90]);
  await button('上传副本到原文件夹').click();
  await expect(editor.getByRole('status')).toContainText('副本已加入上传队列');
  await expect
    .poll(async () =>
      page.evaluate(async (id) => {
        const response = await fetch(
          '/api/console/v1/native/files?parent=' + encodeURIComponent(id),
        );
        if (!response.ok) return [];
        const listing = (await response.json()) as { items: { name: string }[] };
        return listing.items.map((entry) => entry.name);
      }, parentId),
    )
    .toContain('edited-copy.png');

  await editor.locator('[aria-haspopup="listbox"]').click();
  await page.getByRole('option', { name: 'JPEG', exact: true }).click();
  const jpeg = await downloadCopy(page, editor, 'edited-copy.jpg');
  expect(jpeg.subarray(0, 2).toString('hex')).toBe('ffd8');
  const jpegResult = await page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(
      await (await fetch('data:image/jpeg;base64,' + base64)).blob(),
    );
    try {
      const surface = document.createElement('canvas');
      surface.width = bitmap.width;
      surface.height = bitmap.height;
      const context = surface.getContext('2d');
      if (!context) throw new Error('JPEG 检查需要 Canvas');
      context.drawImage(bitmap, 0, 0);
      return {
        width: bitmap.width,
        height: bitmap.height,
        pixel: Array.from(context.getImageData(75, 85, 1, 1).data),
      };
    } finally {
      bitmap.close();
    }
  }, jpeg.toString('base64'));
  expect(jpegResult).toEqual({ width: 80, height: 90, pixel: [255, 255, 255, 255] });
  await page.setViewportSize({ width: 390, height: 844 });
  await button('裁剪').click();
  await expect(canvas).toBeVisible();
  await page.screenshot({ path: info.outputPath('image-editor-mobile.png') });
  await button('关闭').click();
  await expect(editor).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __imageBitmapProbe: { closed: number } }).__imageBitmapProbe
            .closed,
      ),
    )
    .toBe(2);
  await expect(preview.getByRole('img', { name: 'source.png' })).toBeVisible();
  await preview.getByRole('button', { name: '关闭', exact: true }).click();

  const contents = await page.evaluate(async (id) => {
    const listing = (await (
      await fetch('/api/console/v1/native/files?parent=' + encodeURIComponent(id))
    ).json()) as {
      items: { id: string; name: string; contentRevision: number }[];
    };
    const files = await Promise.all(
      ['source.png', 'edited-copy.png'].map(async (name) => {
        const entry = listing.items.find((value) => value.name === name);
        if (!entry) throw new Error('文件不存在');
        const response = await fetch(
          '/api/console/v1/native/files/' + encodeURIComponent(entry.id) + '/content',
        );
        if (!response.ok) throw new Error('读取原始文件失败');
        return {
          ...entry,
          base64: btoa(String.fromCharCode(...new Uint8Array(await response.arrayBuffer()))),
        };
      }),
    );
    return files;
  }, parentId);
  expect(contents[0]).toMatchObject({ base64: original, contentRevision: 1 });
  expect(contents[1]).toMatchObject({ base64: png.toString('base64'), contentRevision: 1 });
  expect(contents[1]?.id).not.toBe(contents[0]?.id);

  await page.getByRole('button', { name: 'source.png 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '版本历史', exact: true }).click();
  await page.locator('[data-file-version="1"]').getByRole('button', { name: '预览此版本' }).click();
  await expect(page.getByRole('img', { name: 'source.png' })).toBeVisible();
  await expect(page.getByRole('button', { name: '编辑图片', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '关闭版本预览', exact: true }).click();

  const share = await page.evaluate(async (rootId) => {
    const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
    const response = await fetch('/api/console/v1/native/files/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
      body: JSON.stringify({
        rootId,
        title: '图片只读验证',
        password: '',
        permissions: {
          browse: true,
          preview: true,
          download: true,
          create: false,
          upload: false,
          modify: false,
          rename: false,
          move: false,
          copy: false,
          delete: false,
        },
      }),
    });
    if (!response.ok) throw new Error('无法创建图片只读测试分享');
    return (await response.json()) as { id: string; token: string };
  }, contents[0]?.id);
  const guest = await browser.newContext({ locale: 'zh-CN' });
  try {
    const shared = await guest.newPage();
    await shared.goto(new URL('/share#token=' + encodeURIComponent(share.token), page.url()).href);
    await shared.getByRole('button', { name: '预览', exact: true }).click();
    await expect(shared.getByRole('img', { name: 'source.png' })).toBeVisible();
    await expect(shared.getByRole('button', { name: '编辑图片', exact: true })).toHaveCount(0);
  } finally {
    await guest.close();
    await page.evaluate(async (id) => {
      const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
      const response = await fetch('/api/console/v1/native/files/shares/' + id + '/revoke', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf.token },
      });
      if (!response.ok) throw new Error('无法撤销图片测试分享');
    }, share.id);
  }
});
