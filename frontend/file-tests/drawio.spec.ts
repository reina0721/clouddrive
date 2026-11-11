import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { expect, test, type Page } from '@playwright/test';
import { openReadingFixtureFolder, readPreviewAccess } from './reading-fixture';
import { drawioEndpoint } from '../surfaces/plugins/files/src/drawio-protocol';

const editorURL = process.env.CLOUDDRIVE_DRAWIO_TEST_URL;
const editorOrigin = new URL(editorURL ?? 'https://embed.diagrams.net/').origin;
const frameSelector = 'iframe[title="Draw.io 绘图编辑器"]';
const filename = 'diagram.drawio';
const diagram = (label: string) =>
  '<mxGraphModel grid="1" page="1"><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
  '<mxCell id="2" value="' +
  label +
  '" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">' +
  '<mxGeometry x="120" y="100" width="120" height="60" as="geometry"/></mxCell></root></mxGraphModel>';

async function login(page: Page) {
  const account = readPreviewAccess();
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await openReadingFixtureFolder(page, '图表验收-');
}

async function filesAPI<T>(
  page: Page,
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' = 'GET',
  body?: unknown,
) {
  return page.evaluate(
    async ({ endpoint, method, body }) => {
      const csrf = await fetch('/api/console/v1/auth/csrf');
      if (!csrf.ok) throw new Error('获取测试 CSRF 失败');
      const { token } = (await csrf.json()) as { token: string };
      const response = await fetch('/api/console/v1/native/files' + endpoint, {
        method,
        ...(method === 'GET'
          ? {}
          : {
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
              body: JSON.stringify(body),
            }),
      });
      if (!response.ok) throw new Error('文件验收接口 HTTP ' + response.status);
      return (await response.json()) as T;
    },
    { endpoint, method, body },
  );
}

async function seed(page: Page, name: string, text: string) {
  const parentId = new URL(page.url()).searchParams.get('parent')!;
  const entry = await filesAPI<{ id: string; contentRevision: number }>(page, '/text', 'POST', {
    parentId,
    name,
    text,
    key: randomUUID(),
  });
  await page.reload();
  return entry;
}

// 用严格限定来源的协议测试页控制竞态。实际编辑器单独通过真实 iframe 验收。
const protocolEditor = String.raw`<!doctype html><meta charset="utf-8">
<textarea aria-label="XML"></textarea>
<button id="change">Change</button><button id="save">Save</button><button id="exit">Exit</button>
<script>
let host;
const xml = document.querySelector('textarea');
const send = (event, extra={}) => parent.postMessage(JSON.stringify({event, ...extra}), host || '*');
addEventListener('message', e => {
  if (e.source !== parent) return;
  const message = JSON.parse(e.data);
  if (message.action === 'configure') { host=e.origin; send('init'); }
  if (message.action === 'load') { xml.value = message.xml; xml.dataset.title = message.title; }
  if (message.action === 'status') document.body.dataset.saved = message.message;
});
document.querySelector('#change').onclick = () => send('autosave', {xml:xml.value});
document.querySelector('#save').onclick = () => send('save', {xml:xml.value});
document.querySelector('#exit').onclick = () => send('exit', {modified:true});
send('configure');
</script>`;

test('图表创建、协议边界、版本冲突和保留草稿', async ({ page }) => {
  test.setTimeout(110_000);
  await login(page);
  let loaded = 0;
  await page.route(
    (url) => url.origin === editorOrigin && url.searchParams.has('embed'),
    async (route) => {
      loaded++;
      expect(await route.request().headerValue('cookie')).toBeNull();
      expect(await route.request().headerValue('referer')).toBeNull();
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body: protocolEditor });
    },
  );
  const originalFolder = new URL(page.url());
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '新建 Draw.io 图表' }).click();
  await page.getByRole('button', { name: '使用此位置' }).click();
  const create = page.getByRole('dialog', { name: '新建 Draw.io 图表', exact: true });
  const consent = create.getByRole('button', { name: '加载 Draw.io', exact: true });
  await expect(consent).toBeDisabled();
  await expect(create.getByText(editorOrigin, { exact: true })).toBeVisible();
  expect(loaded).toBe(0);
  await create.getByRole('textbox', { name: '名称', exact: true }).fill('fresh');
  await consent.click();
  const editor = page.frameLocator(frameSelector);
  await expect(editor.getByRole('textbox', { name: 'XML' })).toHaveAttribute(
    'data-title',
    'fresh.drawio',
  );
  await editor.getByRole('textbox', { name: 'XML' }).fill(diagram('Saved diagram'));
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(create).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'fresh.drawio', exact: true })).toBeVisible();

  const entry = await seed(page, filename, diagram('Original'));
  await page.getByRole('button', { name: filename, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: filename, exact: true });
  await expect(dialog.getByText(editorOrigin, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '加载 Draw.io', exact: true }).click();
  await expect(page.locator(frameSelector)).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(page.locator(frameSelector)).toHaveAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-downloads',
  );
  await expect(editor.getByRole('textbox', { name: 'XML' })).toHaveValue(diagram('Original'));
  await page.evaluate(
    ({ editorOrigin, forged }) => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: editorOrigin,
          source: window,
          data: JSON.stringify({ event: 'autosave', xml: forged }),
        }),
      );
    },
    { editorOrigin, forged: diagram('Forged') },
  );
  await expect(dialog.getByRole('button', { name: '下载草稿' })).toHaveCount(0);
  await editor.getByRole('textbox', { name: 'XML' }).fill('<html>Not a diagram</html>');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('有效的 UTF-8 Draw.io XML');
  await filesAPI(page, '/' + entry.id + '/text', 'PUT', {
    expectedRevision: entry.contentRevision,
    text: diagram('Other editor'),
  });
  const latest = diagram('My unsaved draft');
  await editor.getByRole('textbox', { name: 'XML' }).fill(latest);
  await editor.getByRole('button', { name: 'Change', exact: true }).click();
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('状态已变化');
  const downloading = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载草稿' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(filename);
  expect(await readFile(await download.path(), 'utf8')).toBe(latest);
  await editor.getByRole('button', { name: 'Exit', exact: true }).click();
  const discard = page.getByRole('dialog', { name: '放弃未保存的图表？' });
  await expect(discard).toBeVisible();
  await discard.getByRole('button', { name: '取消', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: 'XML' })).toHaveValue(latest);
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await discard.getByRole('button', { name: '放弃修改' }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto(originalFolder.href);
  await page.getByRole('button', { name: filename, exact: true }).click();
  await dialog.getByRole('button', { name: '加载 Draw.io', exact: true }).click();
  await expect(editor.getByRole('textbox', { name: 'XML' })).toHaveValue(diagram('Other editor'));
});

test('图表地址契约、握手重试和下载原件', async ({ page }) => {
  test.setTimeout(95_000);
  await login(page);
  const origin = new URL(page.url()).origin;
  expect(drawioEndpoint(origin, origin, 'zh')).toBeUndefined();
  expect(drawioEndpoint('http://127.0.0.1:4201/', origin, 'zh')).toBeUndefined();
  expect(drawioEndpoint('http://editor.example.test/', origin, 'zh')).toBeUndefined();
  expect(drawioEndpoint('https://user@editor.example.test/', origin, 'zh')).toBeUndefined();
  expect(
    drawioEndpoint('https://editor.example.test/custom/', origin, 'zh')?.searchParams.get('proto'),
  ).toBe('json');
  await seed(page, filename, diagram('Original after retry'));
  let requests = 0;
  await page.route(
    (url) => url.origin === editorOrigin && url.searchParams.has('embed'),
    async (route) => {
      requests++;
      await route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: requests === 1 ? '<p>Loading</p>' : protocolEditor,
      });
    },
  );
  await page.setViewportSize({ width: 375, height: 760 });
  await page.getByRole('button', { name: filename, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: filename, exact: true });
  const downloading = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载', exact: true }).click();
  expect(await readFile(await (await downloading).path(), 'utf8')).toBe(
    diagram('Original after retry'),
  );
  await dialog.getByRole('button', { name: '加载 Draw.io', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('未完成加载', { timeout: 22_000 });
  await dialog.getByRole('button', { name: '重试加载 Draw.io', exact: true }).click();
  const editor = page.frameLocator(frameSelector);
  await expect(editor.getByRole('textbox', { name: 'XML' })).toHaveValue(
    diagram('Original after retry'),
  );
  expect((await page.locator(frameSelector).boundingBox())!.width).toBeLessThan(375);
});

test('真实 Draw.io 绘制、连接、页面与版本写回', async ({ page }, info) => {
  test.setTimeout(100_000);
  test.skip(!editorURL, '使用指定部署的真实 Draw.io 编辑器。');
  await login(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: filename,
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(diagram('CloudDrive Diagram')),
  });
  const uploads = page.getByRole('dialog', { name: '上传队列', exact: true });
  await expect(uploads.getByText('上传完成', { exact: true })).toBeVisible();
  await uploads.getByRole('button', { name: '关闭', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: filename, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: filename, exact: true });
  const load = dialog.getByRole('button', { name: '加载 Draw.io', exact: true });
  await load.click();
  const editor = page.frameLocator(frameSelector);
  await expect(editor.locator('.geDiagramContainer')).toBeVisible({ timeout: 35_000 });
  const shape = editor.getByText('CloudDrive Diagram', { exact: true });
  await expect(shape).toBeVisible();
  await expect(editor.locator('.geSidebarContainer').first()).toBeVisible();
  await shape.click();
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(shape).toHaveCount(2);
  await page.keyboard.press('Control+z');
  await expect(shape).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(shape).toHaveCount(2);
  await shape.last().dblclick();
  await editor.locator('.mxCellEditor').fill('Connected step');
  await page.keyboard.press('Control+Enter');
  await expect(editor.getByText('Connected step', { exact: true })).toBeVisible();
  const beforeZoom = (await shape.boundingBox())!.width;
  await editor.locator('[title^="放大"]').first().click();
  await expect
    .poll(async () => (await shape.boundingBox())?.width ?? 0)
    .toBeGreaterThan(beforeZoom);
  await editor.locator('.geTabContainer [title^="插入页面"]').click();
  await expect(editor.getByText('第 2 页', { exact: true })).toBeVisible();
  await editor.getByText('第 1 页', { exact: true }).click();
  await page.screenshot({ path: info.outputPath('drawio-desktop.png') });
  await editor.getByText('保存并退出', { exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: filename, exact: true }).click();
  await load.click();
  await expect(editor.getByText('Connected step', { exact: true })).toBeVisible();
  await expect(editor.getByText('第 2 页', { exact: true })).toBeVisible();
  const downloading = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '下载', exact: true }).click();
  const xml = await readFile(await (await downloading).path(), 'utf8');
  const listing = await filesAPI<{ items: { name: string; mediaType: string }[] }>(
    page,
    '?parent=' + new URL(page.url()).searchParams.get('parent'),
  );
  expect(listing.items.find((item) => item.name === filename)?.mediaType).toBe('application/xml');
  const pages = [...xml.matchAll(/<diagram(?:\s[^>]*)?>([\s\S]*?)<\/diagram>/g)].map(([, body]) => {
    const content = body?.trim() ?? '';
    return content.startsWith('<')
      ? content
      : decodeURIComponent(inflateRawSync(Buffer.from(content, 'base64')).toString());
  });
  expect(pages).toHaveLength(2);
  expect(pages[0]).toContain('edge="1"');
  expect(pages[0]).toContain('Connected step');
  await editor.getByText('退出', { exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 760 });
  await page.getByRole('button', { name: filename, exact: true }).click();
  await load.click();
  await expect(page.locator(frameSelector)).toHaveAttribute('src', /ui=min/);
  const mobileCanvas = editor.locator('.geDiagramContainer');
  await expect(mobileCanvas).toBeVisible();
  expect((await mobileCanvas.boundingBox())!.width).toBeGreaterThan(200);
  expect((await page.locator(frameSelector).boundingBox())!.width).toBeLessThan(375);
  await page.screenshot({ path: info.outputPath('drawio-mobile.png') });
});
