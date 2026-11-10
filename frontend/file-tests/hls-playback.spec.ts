import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const samples = join(__dirname, 'fixtures/hls');
const manifest = (lines: readonly string[]) => ['#EXTM3U', ...lines, ''].join('\n');
const segmentLines = (uris: readonly string[]) => uris.flatMap((uri) => ['#EXTINF:1,', uri]);
const media = (uris: readonly string[], options: { live?: true; key?: string } = {}) =>
  manifest([
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:1',
    '#EXT-X-MEDIA-SEQUENCE:0',
    ...(options.key ? [`#EXT-X-KEY:METHOD=AES-128,URI="${options.key}"`] : []),
    ...segmentLines(uris),
    ...(options.live ? [] : ['#EXT-X-ENDLIST']),
  ]);

test.use({ actionTimeout: 15_000 });

test('真实私有 HLS 支持多档清晰度、AES、范围分片和直播刷新', async ({ page, context }, info) => {
  test.setTimeout(150_000);
  const access = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!access, '使用隔离文件预览。');
  const account = JSON.parse((await readFile(access!, 'utf8')).replace(/^\uFEFF/, '')) as {
    username: string;
    password: string;
    url: string;
  };
  expect(new URL(account.url).origin).toBe('http://127.0.0.1:4194');
  const folder = 'HLS验收-' + randomUUID().slice(0, 8);
  const directory = info.outputPath(folder);
  const variants = '变体 目录';
  const segments = '分片';
  await mkdir(join(directory, variants), { recursive: true });
  await mkdir(join(directory, segments));
  const key = randomBytes(16);
  const segmentName = (height: number, index: number) => `${height}-${index}.ts`;
  const indices = [0, 1, 2, 3];
  await writeFile(join(directory, segments, 'stream.key'), key);
  for (const index of indices) {
    const iv = Buffer.alloc(16);
    iv.writeUInt32BE(index, 12);
    const cipher = createCipheriv('aes-128-cbc', key, iv);
    const lower = await readFile(join(samples, `144-${index}.bin`));
    await writeFile(
      join(directory, segments, segmentName(144, index)),
      Buffer.concat([cipher.update(lower), cipher.final()]),
    );
    await copyFile(
      join(samples, `240-${index}.bin`),
      join(directory, segments, segmentName(240, index)),
    );
  }
  const relativeSegment = (height: number, index: number) =>
    `../${encodeURIComponent(segments)}/${segmentName(height, index)}`;
  const absoluteSegment = (index: number) =>
    `/${encodeURIComponent(folder)}/${encodeURIComponent(segments)}/${segmentName(240, index)}`;
  await writeFile(
    join(directory, variants, '144.m3u8'),
    media(
      indices.map((index) => relativeSegment(144, index)),
      { key: `../${encodeURIComponent(segments)}/stream.key` },
    ),
  );
  await writeFile(
    join(directory, variants, '240.m3u8'),
    media(indices.map((index) => relativeSegment(240, index))),
  );
  await writeFile(
    join(directory, 'master.m3u8'),
    manifest([
      '#EXT-X-STREAM-INF:BANDWIDTH=120000,RESOLUTION=256x144',
      `${encodeURIComponent(variants)}/144.m3u8`,
      '#EXT-X-STREAM-INF:BANDWIDTH=230000,RESOLUTION=426x240',
      `/${encodeURIComponent(folder)}/${encodeURIComponent(variants)}/240.m3u8`,
    ]),
  );
  await writeFile(
    join(directory, 'master.vtt'),
    'WEBVTT\n\n00:00:00.000 --> 00:00:03.000\n播放列表示例字幕\n',
  );
  await writeFile(
    join(directory, 'blocked.m3u8'),
    media(['https://outside-hls.example.test/segment.ts']),
  );
  await writeFile(
    join(directory, 'live.m3u8'),
    media(indices.slice(0, 3).map(absoluteSegment), { live: true }),
  );
  for (const name of ['range.mp4', 'range.m3u8'])
    await copyFile(join(samples, name), join(directory, name));

  const requests = new Set<string>();
  const published = new Set<string>();
  let external = 0;
  await page.route('https://outside-hls.example.test/**', async (route) => {
    external++;
    await route.abort();
  });
  page.on('request', (request) => {
    if (/\/versions\/\d+\/content$/.test(request.url())) {
      const range = request.headers().range;
      if (range) requests.add(range);
    }
  });
  page.on('response', (response) => {
    if (response.ok() && /\/native\/files\/transfers\/[^/]+\/commit$/.test(response.url()))
      published.add(response.url());
  });
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  const choose = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '上传目录', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  await (await choose).setFiles(directory);
  const tray = page.getByRole('dialog', { name: '上传队列', exact: true });
  await expect.poll(() => published.size, { timeout: 30_000 }).toBe(17);
  await tray.getByRole('button', { name: '关闭', exact: true }).click();
  const fixtureId = await page.evaluate(async (name) => {
    const response = await fetch('/api/console/v1/native/files?search=' + encodeURIComponent(name));
    if (!response.ok) throw new Error('HLS fixture folder HTTP ' + response.status);
    const listing = (await response.json()) as {
      items: { id: string; name: string; kind: string }[];
    };
    return listing.items.find((entry) => entry.kind === 'folder' && entry.name === name)?.id;
  }, folder);
  expect(fixtureId).toBeDefined();
  await page.goto('/home?parent=' + encodeURIComponent(fixtureId!));
  await page.getByRole('button', { name: 'master.m3u8', exact: true }).click();
  const master = page.getByRole('dialog', { name: 'master.m3u8', exact: true });
  const video = master.locator('video');
  const quality = master.getByRole('button', { name: /清晰度/ });
  await expect(quality).toContainText('自动');
  await quality.click();
  await page.getByRole('option', { name: '144p', exact: true }).click();
  await expect(quality).toContainText('144p');
  const videoHeight = () => video.evaluate((element) => (element as HTMLVideoElement).videoHeight);
  const videoTime = () => video.evaluate((element) => (element as HTMLVideoElement).currentTime);
  await expect.poll(videoHeight).toBe(144);
  await expect
    .poll(() =>
      video.evaluate((element) =>
        Array.from((element as HTMLVideoElement).textTracks)
          .flatMap((track) => Array.from(track.cues ?? []))
          .map((cue) => (cue as VTTCue).text),
      ),
    )
    .toContain('播放列表示例字幕');
  await video.evaluate((element) => (element as HTMLVideoElement).play());
  await expect.poll(videoTime).toBeGreaterThan(0);
  await video.evaluate((element) => {
    const player = element as HTMLVideoElement;
    player.pause();
    player.currentTime = 1.5;
  });
  await expect.poll(videoTime).toBeCloseTo(1.5, 1);
  await quality.click();
  await page.getByRole('option', { name: '240p', exact: true }).click();
  await video.evaluate((element) => (element as HTMLVideoElement).play());
  await expect.poll(videoHeight).toBe(240);
  await video.evaluate((element) => (element as HTMLVideoElement).pause());
  await quality.click();
  await expect(page.getByRole('option', { name: '240p', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('hls-desktop.png'), animations: 'disabled' });
  await page.getByRole('option', { name: /^自动/ }).click();
  await expect(quality).toContainText(/自动 · (144p|240p)/);
  const download = page.waitForEvent('download');
  await master.getByRole('button', { name: '下载', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('master.m3u8');
  await master.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(video).toHaveCount(0);

  await page.setViewportSize({ width: 375, height: 760 });
  await page.getByRole('button', { name: 'range.m3u8 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '打开方式', exact: true }).click();
  await page
    .getByRole('dialog', { name: '打开方式', exact: true })
    .getByRole('button', { name: '视频播放器', exact: true })
    .click();
  const range = page.getByRole('dialog', { name: 'range.m3u8', exact: true });
  await expect
    .poll(() =>
      range.locator('video').evaluate((element) => (element as HTMLVideoElement).videoHeight),
    )
    .toBe(144);
  expect([...requests]).toContain('bytes=0-817');
  expect([...requests]).toContain('bytes=818-9876');
  await expect
    .poll(() => range.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
  await page.screenshot({ path: info.outputPath('hls-mobile.png'), animations: 'disabled' });
  await range.getByRole('button', { name: '关闭', exact: true }).click();

  await page.getByRole('button', { name: 'blocked.m3u8', exact: true }).click();
  const blocked = page.getByRole('dialog', { name: 'blocked.m3u8', exact: true });
  await expect(blocked.getByRole('alert')).toContainText('无法读取播放列表引用的文件');
  await blocked.getByRole('button', { name: '重试', exact: true }).click();
  await expect(blocked.getByRole('alert')).toContainText('无法读取播放列表引用的文件');
  expect(external).toBe(0);
  await blocked.getByRole('button', { name: '关闭', exact: true }).click();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: 'live.m3u8', exact: true }).click();
  const live = page.getByRole('dialog', { name: 'live.m3u8', exact: true });
  await expect(live.getByRole('button', { name: '回到直播', exact: true })).toBeVisible();
  const editor = await context.newPage();
  try {
    await editor.goto(page.url());
    await editor.getByRole('button', { name: 'live.m3u8 的操作', exact: true }).click();
    const replace = editor.waitForEvent('filechooser');
    await editor.getByRole('menuitem', { name: '上传新版本', exact: true }).click();
    const refreshed = page.waitForResponse(
      (response) => /\/versions\/2\/content$/.test(response.url()) && response.ok(),
    );
    await (
      await replace
    ).setFiles({
      name: 'live.m3u8',
      mimeType: 'application/vnd.apple.mpegurl',
      buffer: Buffer.from(media(indices.map(absoluteSegment), { live: true })),
    });
    const editorTray = editor.getByRole('dialog', { name: '上传队列', exact: true });
    if (!(await editorTray.isVisible()))
      await editor.getByRole('button', { name: /^上传队列/ }).click();
    await expect(editorTray.getByText('上传完成', { exact: true }).first()).toBeVisible();
    await refreshed;
    await live.getByRole('button', { name: '回到直播', exact: true }).click();
    await expect
      .poll(() =>
        live.locator('video').evaluate((element) => (element as HTMLVideoElement).currentTime),
      )
      .toBeGreaterThan(0);
  } finally {
    await editor.close();
  }
  await live.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(live).toHaveCount(0);
});
