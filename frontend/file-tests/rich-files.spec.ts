import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function newAction(page: Page, label: string) {
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
  await expect(page.getByRole('dialog', { name: '新建', exact: true })).toHaveCount(0);
}
async function fileAction(page: Page, name: string, label: string) {
  await page.getByRole('button', { name: name + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
  await expect(page.getByRole('dialog', { name: name + ' 的操作', exact: true })).toHaveCount(0);
}
async function createText(
  page: Page,
  mode: '新建文本' | '新建 Markdown',
  name: string,
  text: string,
) {
  await newAction(page, mode);
  await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill(name);
  await page.getByRole('dialog').getByLabel('文件内容', { exact: true }).fill(text);
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
test.beforeEach(async ({ page }) => {
  const access = JSON.parse(
    (await readFile(resolve(__dirname, '../../.data/preview-access.json'), 'utf8')).replace(
      /^\uFEFF/,
      '',
    ),
  ) as { username: string; password: string };
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.getByRole('button', { name: '列表', exact: true }).click();
});

test('文本与 Markdown、双窗口编辑冲突、独立副本、右键菜单、快捷键和真实 ZIP', async ({
  page,
  context,
}) => {
  const suffix = Date.now().toString(36),
    name = `编辑-${suffix}.md`,
    copy = `副本-${suffix}.md`,
    plain = `文本-${suffix}.txt`;
  await newAction(page, '新建文本');
  await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill('../invalid');
  await page.getByRole('dialog').getByLabel('文件内容', { exact: true }).fill('保留输入');
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('名称、内容或有效期不符合要求');
  await expect(page.getByRole('dialog').getByLabel('文件内容', { exact: true })).toHaveValue(
    '保留输入',
  );
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await createText(page, '新建文本', plain.replace(/\.txt$/, ''), '纯文本');
  await expect(page.getByRole('button', { name: plain, exact: true })).toBeVisible();
  await createText(
    page,
    '新建 Markdown',
    name.replace(/\.md$/, ''),
    '# 标题\n<script>不可执行</script>',
  );
  const second = await context.newPage();
  await second.goto('/home');
  await fileAction(page, name, '编辑文本');
  await expect(page.getByRole('dialog').getByLabel('文件内容', { exact: true })).toHaveValue(
    /# 标题/,
  );
  await fileAction(second, name, '编辑文本');
  await expect(second.getByRole('dialog').getByLabel('文件内容', { exact: true })).toHaveValue(
    /# 标题/,
  );
  await page.getByRole('dialog').getByLabel('文件内容', { exact: true }).fill('第一窗口已提交');
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await second.getByRole('dialog').getByLabel('文件内容', { exact: true }).fill('第二窗口未覆盖');
  await second.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(second.getByRole('dialog')).toContainText('内容已被其他窗口更改');
  await expect(second.getByRole('dialog').getByLabel('文件内容', { exact: true })).toHaveValue(
    '第二窗口未覆盖',
  );
  await second.close();
  await page
    .locator('article')
    .filter({ has: page.getByRole('button', { name, exact: true }) })
    .click({ button: 'right' });
  await page.getByRole('menuitem', { name: '复制', exact: true }).click();
  await expect(page.getByRole('dialog', { name: name + ' 的操作', exact: true })).toHaveCount(0);
  await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill(copy);
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('button', { name: copy, exact: true })).toBeVisible();
  await fileAction(page, copy, '编辑文本');
  await expect(page.getByRole('dialog').getByLabel('文件内容', { exact: true })).toHaveValue(
    '第一窗口已提交',
  );
  await page.getByRole('dialog').getByLabel('文件内容', { exact: true }).fill('副本独立修改');
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('dialog').locator('pre')).toHaveText('第一窗口已提交');
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('checkbox', { name: `选择 ${name}`, exact: true }).press('Space');
  await page.getByRole('checkbox', { name: `选择 ${copy}`, exact: true }).press('Space');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '打包下载', exact: true }).click();
  const archive = await downloaded;
  const archivePath = await archive.path();
  expect(archivePath).not.toBeNull();
  const zip = await readFile(archivePath);
  expect(zip.subarray(0, 2).toString()).toBe('PK');
  expect(zip.includes(Buffer.from('第一窗口已提交'))).toBe(true);
  expect(zip.includes(Buffer.from('副本独立修改'))).toBe(true);
  await page.getByRole('button', { name, exact: true }).focus();
  await page.keyboard.press('Escape');
  await page.getByRole('checkbox', { name: `选择 ${name}`, exact: true }).press('Space');
  await page.getByRole('button', { name, exact: true }).focus();
  await page.keyboard.press('F2');
  await expect(page.getByRole('dialog').getByLabel('名称', { exact: true })).toHaveValue(name);
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox', { name: '搜索文件' })).toBeFocused();
});

test('密码分享、匿名目录浏览与字节下载、跨目录拒绝及已有票据撤销', async ({ page, browser }) => {
  const suffix = Date.now().toString(36),
    folder = `分享目录-${suffix}`,
    name = `访客-${suffix}.txt`,
    outside = `分享外-${suffix}.txt`;
  await createText(page, '新建文本', outside.replace(/\.txt$/, ''), 'private fixture');
  const outsideID = await page.evaluate(async (name) => {
    const response = await fetch('/api/console/v1/native/files');
    const body = (await response.json()) as { items: { id: string; name: string }[] };
    return body.items.find((item) => item.name === name)?.id;
  }, outside);
  expect(outsideID).toBeTruthy();
  await newAction(page, '创建文件夹');
  await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill(folder);
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await page.getByRole('button', { name: folder, exact: true }).click();
  await expect(page).toHaveURL(/parent=/);
  await createText(page, '新建文本', name.replace(/\.txt$/, ''), 'visitor verified bytes');
  await page.goto('/home');
  await fileAction(page, folder, '分享');
  const password = randomUUID();
  await page.getByRole('dialog').getByLabel('访问密码（可选）', { exact: true }).fill(password);
  await page.getByRole('dialog').getByRole('button', { name: '创建分享链接', exact: true }).click();
  const url = await page.getByRole('dialog').getByRole('link').getAttribute('href');
  expect(url).toBeTruthy();
  if (!url) throw new Error('Missing share URL');
  await writeFile(
    resolve(__dirname, '../../.data/121-preview-sample.json'),
    JSON.stringify({ url, password, revokedAfterTest: true }, null, 2),
  );
  const anonymous = await browser.newContext();
  const visitor = await anonymous.newPage();
  await visitor.goto(url);
  await expect(visitor.getByRole('main')).toHaveCount(1);
  await expect(visitor.getByLabel('访问密码', { exact: true })).toBeVisible();
  await expect(visitor.getByText(name, { exact: true })).toHaveCount(0);
  await visitor.getByLabel('访问密码', { exact: true }).fill(randomUUID());
  await visitor.getByRole('button', { name: '访问分享', exact: true }).click();
  await expect(visitor.getByRole('main').getByRole('alert')).toContainText('正确的访问密码');
  await visitor.getByLabel('访问密码', { exact: true }).fill(password);
  const unlocking = visitor.waitForResponse(
    (response) => response.url().includes('/unlock') && response.status() === 200,
  );
  await visitor.getByRole('button', { name: '访问分享', exact: true }).click();
  const grant = (await (await unlocking).json()) as { ticket: string };
  await expect(visitor.getByText(name, { exact: true })).toBeVisible();
  await visitor.screenshot({ path: 'test-results/file-share-desktop.png', fullPage: true });
  await visitor.setViewportSize({ width: 390, height: 844 });
  expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await visitor.screenshot({ path: 'test-results/file-share-mobile.png', fullPage: true });
  const download = visitor.waitForEvent('download');
  await visitor.getByRole('button', { name: '下载文件', exact: true }).click();
  const downloaded = await download;
  const path = await downloaded.path();
  expect(path).not.toBeNull();
  expect((await readFile(path)).toString()).toBe('visitor verified bytes');
  const token = new URLSearchParams(new URL(url).hash.slice(1)).get('token');
  const denied = await anonymous.request.get(
    new URL(`/api/v1/file-shares/${token}/content/${outsideID}`, url).href,
    { headers: { 'X-Share-Grant': grant.ticket } },
  );
  expect(denied.status()).toBe(404);
  await page.goto('/home/shares');
  const row = page.getByRole('listitem').filter({ hasText: folder });
  await expect(row).toContainText('密码保护');
  await row.getByRole('button', { name: '撤销分享', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(row).toContainText('已撤销');
  await visitor.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(visitor.getByText(name, { exact: true })).toHaveCount(0);
  await expect(visitor.getByRole('main').getByRole('alert')).toContainText('分享已撤销');
  await visitor.reload();
  await expect(visitor.getByText(name, { exact: true })).toHaveCount(0);
  const revoked = await anonymous.request.get(
    new URL(`/api/v1/file-shares/${token}/entries`, url).href,
    { headers: { 'X-Share-Grant': grant.ticket } },
  );
  expect(revoked.status()).toBe(404);
  await anonymous.close();
});

function waveFixture(): Buffer {
  const sampleRate = 8000,
    samples = sampleRate;
  const output = Buffer.alloc(44 + samples * 2);
  output.write('RIFF');
  output.writeUInt32LE(output.length - 8, 4);
  output.write('WAVEfmt ', 8);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write('data', 36);
  output.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index++)
    output.writeInt16LE(
      Math.round(Math.sin((index * 2 * Math.PI * 440) / sampleRate) * 1000),
      44 + index * 2,
    );
  return output;
}
test('目录层级上传与复制、图片画廊、真实音视频播放和剪贴板文件持久化', async ({ page }) => {
  const suffix = Date.now().toString(36),
    folder = `媒体目录-${suffix}`,
    copy = `媒体副本-${suffix}`,
    pasted = `粘贴-${suffix}.txt`;
  const media = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.fillStyle = '#1689cc';
    context.fillRect(0, 0, 320, 180);
    const png = canvas.toDataURL('image/png').split(',')[1];
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const finished = new Promise<void>((resolveStop) => {
      recorder.onstop = () => resolveStop();
    });
    recorder.start();
    let frame = 0;
    const drawing = setInterval(() => {
      context.fillStyle = frame++ % 2 ? '#1689cc' : '#31a176';
      context.fillRect(0, 0, 320, 180);
    }, 70);
    await new Promise<void>((resolveStop) => setTimeout(resolveStop, 600));
    recorder.stop();
    await finished;
    clearInterval(drawing);
    for (const track of stream.getTracks()) track.stop();
    return {
      png,
      video: Array.from(
        new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()),
      ),
    };
  });
  if (!media.png) throw new Error('Missing PNG fixture');
  const directory = resolve(__dirname, '../../.data/121-fixtures', folder);
  await mkdir(join(directory, '子目录'), { recursive: true });
  await writeFile(join(directory, 'image.png'), Buffer.from(media.png, 'base64'));
  await writeFile(
    join(directory, 'unsafe.png'),
    '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__unsafeImageExecuted=true"><script>window.__unsafeImageExecuted=true</script></svg>',
  );
  await writeFile(join(directory, '子目录', 'audio.wav'), waveFixture());
  await writeFile(join(directory, 'video.webm'), Buffer.from(media.video));
  const choose = page.waitForEvent('filechooser');
  await newAction(page, '上传目录');
  await (await choose).setFiles(directory);
  await expect(page.getByText('上传完成', { exact: true })).toHaveCount(4);
  await page.getByRole('button', { name: folder, exact: true }).click();
  await page.evaluate(() => {
    const revoked: string[] = [];
    Object.defineProperty(window, '__fileTestRevokedURLs', { value: revoked, configurable: true });
    const release = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      revoked.push(url);
      release(url);
    };
  });
  await page.getByRole('button', { name: 'image.png', exact: true }).click();
  const imageURL = await page.getByRole('dialog').getByRole('img').getAttribute('src');
  await expect(page.getByRole('dialog').getByRole('img', { name: 'image.png' })).toBeVisible();
  expect(
    await page
      .getByRole('dialog')
      .getByRole('img')
      .evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBe(320);
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    await page.evaluate(
      (url) =>
        (window as unknown as { __fileTestRevokedURLs: string[] }).__fileTestRevokedURLs.includes(
          url ?? '',
        ),
      imageURL,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: '画廊', exact: true }).click();
  await expect(page.getByRole('img', { name: 'image.png', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'unsafe.png', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'unsafe.png', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('浏览器无法预览该格式');
  await expect(page.getByRole('dialog').getByRole('img')).toHaveCount(0);
  expect(await page.evaluate(() => '__unsafeImageExecuted' in window)).toBe(false);
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'video.webm', exact: true }).click();
  const video = page.getByRole('dialog').locator('video');
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute('src', /^blob:/);
  const ownedVideo = await video.elementHandle();
  if (!ownedVideo) throw new Error('Missing video element');
  await video.evaluate(async (element: HTMLVideoElement) => {
    element.muted = true;
    await element.play();
  });
  await expect
    .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
    .toBeGreaterThan(0);
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.locator('video')).toHaveCount(0);
  expect(
    await ownedVideo.evaluate(
      (element) => (element as HTMLMediaElement).paused && element.getAttribute('src') === null,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: '子目录', exact: true }).click();
  await page.getByRole('button', { name: 'audio.wav', exact: true }).click();
  const audio = page.getByRole('dialog').locator('audio');
  await expect(audio).toBeVisible();
  await expect(audio).toHaveAttribute('src', /^blob:/);
  const ownedAudio = await audio.elementHandle();
  if (!ownedAudio) throw new Error('Missing audio element');
  await audio.evaluate(async (element: HTMLAudioElement) => {
    element.muted = true;
    await element.play();
  });
  await expect
    .poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime))
    .toBeGreaterThan(0);
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.locator('audio')).toHaveCount(0);
  expect(
    await ownedAudio.evaluate(
      (element) => (element as HTMLMediaElement).paused && element.getAttribute('src') === null,
    ),
  ).toBe(true);
  const transfer = await page.evaluateHandle((name) => {
    const contents = new DataTransfer();
    contents.items.add(new File(['clipboard persistent bytes'], name, { type: 'text/plain' }));
    return contents;
  }, pasted);
  await page
    .locator('main')
    .evaluate(
      (element, clipboardData) =>
        element.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
        ),
      transfer,
    );
  await expect(page.getByRole('button', { name: pasted, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: pasted, exact: true })).toBeVisible();
  await page.goto('/home');
  await page.getByRole('button', { name: '列表', exact: true }).click();
  await fileAction(page, folder, '复制');
  await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill(copy);
  await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).click();
  await page.getByRole('button', { name: copy, exact: true }).click();
  await expect(page.getByRole('button', { name: 'image.png', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '子目录', exact: true }).click();
  await expect(page.getByRole('button', { name: pasted, exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/files-rich-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/files-rich-mobile.png', fullPage: true });
});
