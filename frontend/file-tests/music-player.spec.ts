import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const trackNames = ['01 tagged.wav', '02 plain.wav', '03 last.wav'] as const;

function waveChunk(kind: string, bytes: Buffer) {
  const header = Buffer.alloc(8);
  header.write(kind, 0, 'ascii');
  header.writeUInt32LE(bytes.length, 4);
  return Buffer.concat([header, bytes, Buffer.alloc(bytes.length % 2)]);
}

function id3Frame(kind: string, bytes: Buffer) {
  const header = Buffer.alloc(10);
  header.write(kind, 0, 'ascii');
  header.writeUInt32BE(bytes.length, 4);
  return Buffer.concat([header, bytes]);
}

function wave(art?: Buffer) {
  const format = Buffer.alloc(16);
  const samplesPerSecond = 8000;
  format.writeUInt16LE(1, 0);
  format.writeUInt16LE(1, 2);
  format.writeUInt32LE(samplesPerSecond, 4);
  format.writeUInt32LE(samplesPerSecond * 2, 8);
  format.writeUInt16LE(2, 12);
  format.writeUInt16LE(16, 14);
  const samples = Buffer.alloc(samplesPerSecond * 40 * 2);
  const chunks = [waveChunk('fmt ', format), waveChunk('data', samples)];
  if (art) {
    const frames = Buffer.concat([
      id3Frame('TIT2', Buffer.from('\0North Shore')),
      id3Frame('TPE1', Buffer.from('\0Example Artist')),
      id3Frame('TALB', Buffer.from('\0Example Album')),
      id3Frame('APIC', Buffer.concat([Buffer.from('\0image/png\0\x03\0'), art])),
    ]);
    const header = Buffer.from([
      73,
      68,
      51,
      3,
      0,
      0,
      0,
      0,
      (frames.length >> 7) & 0x7f,
      frames.length & 0x7f,
    ]);
    chunks.push(waveChunk('id3 ', Buffer.concat([header, frames])));
  }
  return waveChunk('RIFF', Buffer.concat([Buffer.from('WAVE'), ...chunks]));
}

async function setupTracks(page: Page) {
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
  ) as {
    username: string;
    password: string;
  };
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  const parent = await page.evaluate(async () => {
    const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
    const response = await fetch('/api/console/v1/native/files/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
      body: JSON.stringify({ parentId: '', name: 'music-test-' + crypto.randomUUID() }),
    });
    if (!response.ok) throw new Error('无法创建音乐测试目录');
    return ((await response.json()) as { id: string }).id;
  });
  await page.goto('/home?parent=' + parent);
  await page.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('menuitem', { name: '列表', exact: true }).click();

  const cover = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建封面');
    context.fillStyle = '#9e3685';
    context.fillRect(0, 0, 24, 24);
    return canvas.toDataURL('image/png').split(',')[1] ?? '';
  });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  await (
    await chooser
  ).setFiles(
    trackNames.map((name, index) => ({
      name,
      mimeType: 'audio/wav',
      buffer: wave(index === 0 ? Buffer.from(cover, 'base64') : undefined),
    })),
  );
  const uploads = page.getByRole('dialog', { name: '上传队列', exact: true });
  await expect(uploads.getByText('上传完成', { exact: true })).toHaveCount(trackNames.length);
  await uploads.getByRole('button', { name: '关闭', exact: true }).click();
}

async function seekToEnd(audio: Locator) {
  await audio.evaluate((node: HTMLAudioElement) => {
    node.currentTime = node.duration - 0.15;
  });
}

test('顶部播放器保留进度、验证元信息、队列和循环并释放资源', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setupTracks(page);
  await page.evaluate(() => {
    const urls: string[] = [];
    Object.defineProperty(window, '__musicRevokedURLs', { value: urls });
    const release = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      urls.push(url);
      release(url);
    };
  });
  const content = '**/native/files/*/content';
  await page.route(content, (route) => route.fulfill({ status: 503, body: '{}' }), { times: 1 });
  await page.getByRole('button', { name: trackNames[0], exact: true }).click();
  const player = page.getByRole('dialog', { name: '音乐播放器', exact: true });
  const button = (name: string) => player.getByRole('button', { name, exact: true });
  const audio = page.locator('audio');
  await expect(player.getByRole('alert')).toBeVisible();
  await button('重试').click();
  await expect(audio).toHaveAttribute('src', /^blob:/);
  await expect(player.getByText('North Shore', { exact: true })).toBeVisible();
  await expect(player.getByText('Example Artist', { exact: true })).toBeVisible();
  await expect(player.getByText('Example Album', { exact: true })).toBeVisible();
  const art = player.getByRole('img', { name: '曲目封面', exact: true });
  await expect.poll(() => art.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(24);
  const sourceURL = await audio.getAttribute('src');
  const coverURL = await art.getAttribute('src');
  const retainedNode = await audio.elementHandle();
  if (!retainedNode) throw new Error('找不到播放节点');

  const progress = player.getByRole('slider', { name: '播放进度' });
  await expect(progress).toBeEnabled();
  if (await button('播放').isVisible()) await button('播放').click();
  await expect(button('暂停')).toBeVisible();
  await button('暂停').click();
  await expect(button('播放')).toBeVisible();
  await progress.press('Home');
  await progress.press('ArrowRight');
  await expect
    .poll(() => audio.evaluate((node: HTMLAudioElement) => node.currentTime))
    .toBeCloseTo(0.1);
  await expect(player.getByText('−0:39', { exact: false })).toBeVisible();
  const volume = player.getByRole('slider', { name: '音量', exact: true });
  await volume.press('Home');
  await volume.press('ArrowRight');
  await expect
    .poll(() => audio.evaluate((node: HTMLAudioElement) => node.volume))
    .toBeCloseTo(0.01);
  await button('静音').click();
  await expect.poll(() => audio.evaluate((node: HTMLAudioElement) => node.muted)).toBe(true);
  await button('恢复音量').click();
  await expect.poll(() => audio.evaluate((node: HTMLAudioElement) => node.muted)).toBe(false);

  await button('播放').click();
  await expect(button('暂停')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(player).toHaveCount(0);
  const before = await audio.evaluate((node: HTMLAudioElement) => node.currentTime);
  await expect
    .poll(() => audio.evaluate((node: HTMLAudioElement) => node.currentTime))
    .toBeGreaterThan(before);
  await page.getByRole('button', { name: '音乐播放器', exact: true }).click();
  await expect(player.getByText('North Shore', { exact: true })).toBeVisible();
  await expect(audio).toHaveAttribute('src', sourceURL ?? '');
  await page.screenshot({ path: info.outputPath('music-player-desktop.png') });

  await button('显示播放队列').click();
  const queue = player.getByRole('list', { name: '播放队列', exact: true });
  await expect(queue.getByRole('listitem')).toHaveCount(3);
  await expect(queue.locator('[aria-current="true"]')).toContainText(trackNames[0]);
  await button('下一首').click();
  await expect(queue.locator('[aria-current="true"]')).toContainText(trackNames[1]);
  await expect(player.getByText(trackNames[1], { exact: true }).first()).toBeVisible();
  await expect(art).toHaveCount(0);
  await button('上一首').click();
  await expect(queue.locator('[aria-current="true"]')).toContainText(trackNames[0]);
  await queue.getByRole('button', { name: trackNames[1], exact: true }).click();
  await expect(queue.locator('[aria-current="true"]')).toContainText(trackNames[1]);
  await expect(button('暂停')).toBeVisible();
  await seekToEnd(audio);
  await expect(queue.locator('[aria-current="true"]')).toContainText(trackNames[2]);
  await expect(button('暂停')).toBeVisible();
  await expect(button('下一首')).toBeDisabled();
  await seekToEnd(audio);
  await expect(button('播放')).toBeVisible();
  await expect(queue.locator('[aria-current="true"]')).toContainText(trackNames[2]);

  await button('顺序播放').click();
  await expect(button('单曲循环')).toBeVisible();
  await button('播放').click();
  await expect(button('暂停')).toBeVisible();
  await seekToEnd(audio);
  await expect
    .poll(() => audio.evaluate((node: HTMLAudioElement) => node.currentTime))
    .toBeLessThan(2);
  await expect(queue.locator('[aria-current="true"]')).toContainText(trackNames[2]);
  await button('单曲循环').click();
  await expect(button('列表循环')).toBeVisible();
  await seekToEnd(audio);
  await expect(queue.locator('[aria-current="true"]')).toContainText(trackNames[0]);
  await expect(player.getByText('North Shore', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(player).toBeVisible();
  const playPosition = await button('暂停').boundingBox();
  const queuePosition = await button('隐藏播放队列').boundingBox();
  expect(Math.abs((playPosition?.y ?? 0) - (queuePosition?.y ?? -100))).toBeLessThan(4);
  await page.screenshot({ path: info.outputPath('music-player-mobile.png') });
  await button('停止播放器').click();
  await expect(audio).toHaveCount(0);
  expect(
    await retainedNode.evaluate(
      (node) => (node as HTMLAudioElement).paused && node.getAttribute('src') === null,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      ({ source, cover }) => {
        const urls = (window as unknown as { __musicRevokedURLs: string[] }).__musicRevokedURLs;
        return urls.includes(source ?? '') && urls.includes(cover ?? '');
      },
      { source: sourceURL, cover: coverURL },
    ),
  ).toBe(true);

  await page.goto('/ui-elements/forms');
  const demo = page.getByRole('slider', { name: '调整数值', exact: true });
  await demo.press('End');
  await expect(page.getByText('当前数值 100', { exact: true })).toBeVisible();
  await expect(page.getByRole('slider', { name: '禁用输入', exact: true })).toBeDisabled();
});
