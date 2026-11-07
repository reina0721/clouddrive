import { expect, test, type Page } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const accessPath = resolve(
  __dirname,
  process.env.CLOUDDRIVE_FILE_TEST_ACCESS ?? '../../.data/preview-access.json',
);

async function makeVideo(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('画布不可用');
    const stream = canvas.captureStream(12);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const chunks: Blob[] = [];
    recorder.addEventListener('dataavailable', (event) => chunks.push(event.data));
    const stopped = new Promise<void>((resolve) =>
      recorder.addEventListener('stop', () => resolve(), { once: true }),
    );
    recorder.start();
    for (let index = 0; index < 23; index++) {
      const sky = context.createLinearGradient(0, 0, 640, 360);
      sky.addColorStop(0, '#16396f');
      sky.addColorStop(1, '#0f766e');
      context.fillStyle = sky;
      context.fillRect(0, 0, 640, 360);
      context.fillStyle = '#dcfce7';
      context.beginPath();
      context.arc(120 + index * 14, 145, 48, 0, 2 * Math.PI);
      context.fill();
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  return Buffer.from(bytes);
}

test('F521–F540：真实视频的自动外挂字幕、三格式切换、关闭及失败隔离', async ({ page }, info) => {
  const access = JSON.parse((await readFile(accessPath, 'utf8')).replace(/^\uFEFF/, '')) as {
    username: string;
    password: string;
  };
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  const folder = await page.evaluate(async () => {
    const token = ((await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string })
      .token;
    const response = await fetch('/api/console/v1/native/files/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
      body: JSON.stringify({ name: '字幕验收-' + Date.now(), parentId: '' }),
    });
    if (!response.ok) throw new Error('夹具目录创建失败');
    return (await response.json()) as { id: string };
  });
  await page.goto('/home?parent=' + folder.id);
  const name = '片段-Café.webm';
  const vttName = '片段-CAFE\u0301.vtt';
  const srtName = '片段-Café.srt';
  const videoBytes = await makeVideo(page);
  const select = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
  const vtt = '\uFEFFWEBVTT\n\n00:00:00.100 --> 00:00:01.950\n同步字幕 — 海风\n第二行\n';
  const srt = '1\r\n00:00:00,100 --> 00:00:01,950\r\n手动 SRT\r\n';
  const ass = [
    '[Script Info]',
    'ScriptType: v4.00+',
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    'Dialogue: 0,0:00:00.10,0:00:01.95,Default,,0,0,0,,{\\b1}手动 ASS, comma\\N<script>字幕</script>',
    '',
  ].join('\n');
  const subtitles = [
    [vttName, vtt],
    [srtName, srt],
    ['手动.ass', ass],
    ['损坏.vtt', 'not a WEBVTT file'],
    ['超大.srt', 'x'.repeat(256 * 1024 + 1)],
    ['超多.vtt', 'WEBVTT\n\n' + '00:00.100 --> 00:00.200\nx\n\n'.repeat(5001)],
  ] as const;
  await (
    await select
  ).setFiles([
    { name, mimeType: 'video/webm', buffer: videoBytes },
    ...subtitles.map(([name, text]) => ({
      name,
      mimeType: 'text/plain',
      buffer: Buffer.from(text),
    })),
  ]);
  const queue = page.getByRole('dialog', { name: '上传队列', exact: true });
  await expect(queue.getByText('上传完成', { exact: true })).toHaveCount(subtitles.length + 1);
  await queue.getByRole('button', { name: '关闭', exact: true }).click();
  const srtId = await page.evaluate(
    async ({ folderId, name }) => {
      const response = await fetch(
        '/api/console/v1/native/files?parent=' + encodeURIComponent(folderId),
      );
      if (!response.ok) throw new Error('字幕目录读取失败');
      const listing = (await response.json()) as { items: { id: string; name: string }[] };
      return listing.items.find((file) => file.name === name)?.id;
    },
    { folderId: folder.id, name: srtName },
  );
  expect(srtId).toBeTruthy();
  await page.getByRole('button', { name, exact: true }).click();
  const player = page.getByRole('dialog', { name, exact: true });
  const video = player.locator('video');
  const menu = player.getByRole('button', { name: /字幕/ });
  const snapshot = () =>
    video.evaluate((element: HTMLVideoElement) => {
      const track = element.textTracks[0];
      const cue = track?.cues?.[0] as VTTCue | undefined;
      const fragment = cue?.getCueAsHTML();
      return {
        count: element.textTracks.length,
        mode: track?.mode,
        text: fragment?.textContent,
        injected: Boolean(fragment?.querySelector('script')),
        active: track?.activeCues?.length,
        position: element.currentTime,
      };
    });
  await expect.poll(async () => (await snapshot()).text).toContain('海风\n第二行');
  await expect(menu).toContainText(/片段-CAF/);
  await video.evaluate(async (element: HTMLVideoElement) => {
    await element.play();
    element.pause();
    element.currentTime = 0.65;
  });
  await expect.poll(async () => (await snapshot()).active).toBe(1);
  expect((await video.boundingBox())?.width ?? 0).toBeGreaterThan(560);
  await expect(video).toBeInViewport({ ratio: 0.98 });
  await expect(player.getByRole('button', { name: '下载', exact: true })).toBeInViewport();
  await page.screenshot({
    path: info.outputPath('video-subtitles-desktop.png'),
    animations: 'disabled',
  });
  const src = await video.getAttribute('src');
  async function choose(label: string) {
    await menu.press('Enter');
    await page.getByRole('option', { name: label, exact: true }).click();
  }
  await page.route(
    '**/native/files/' + String(srtId) + '/content',
    (route) => route.fulfill({ status: 503, json: {} }),
    { times: 1 },
  );
  await choose(srtName);
  await expect(player.getByRole('alert')).toContainText('服务暂时不可用');
  await player.getByRole('button', { name: '重试', exact: true }).click();
  await expect.poll(async () => (await snapshot()).text).toBe('手动 SRT');
  await choose('手动.ass');
  await expect
    .poll(async () => (await snapshot()).text)
    .toBe('手动 ASS, comma\n<script>字幕</script>');
  expect((await snapshot()).injected).toBe(false);
  expect((await snapshot()).position).toBeCloseTo(0.65, 1);
  expect((await snapshot()).count).toBe(1);
  await expect(video).toHaveAttribute('src', src!);
  await choose('关闭字幕');
  await expect.poll(async () => (await snapshot()).mode).toBe('disabled');
  await choose('损坏.vtt');
  await expect(player.getByText('无法读取字幕。', { exact: false })).toBeVisible();
  await expect(video).toHaveAttribute('src', src!);
  await choose('超大.srt');
  await expect(player.getByRole('alert')).toBeVisible();
  await choose('超多.vtt');
  await expect(player.getByRole('alert')).toBeVisible();
  await expect(video).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await choose(srtName);
  await expect.poll(async () => (await snapshot()).active).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: info.outputPath('video-subtitles-mobile.png'),
    animations: 'disabled',
  });
  await writeFile(info.outputPath('video-folder.json'), JSON.stringify({ parent: folder.id }));
  await player.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(video).toHaveCount(0);
});
