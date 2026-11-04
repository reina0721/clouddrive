import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

test.use({ actionTimeout: 15_000 });
async function login(page: Page) {
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
}
async function api(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<Record<string, unknown>> {
  const response = await page.evaluate(
    async ({ path, method, body }) => {
      const csrf = (await (
        await fetch('/api/console/v1/auth/csrf', { credentials: 'include', cache: 'no-store' })
      ).json()) as { token: string };
      const response = await fetch('/api/console/v1/native/files' + path, {
        method,
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, value: (await response.json()) as Record<string, unknown> };
    },
    { path, method, body },
  );
  expect(response.status, method + ' ' + path).toBe(200);
  return response.value;
}

async function fixture(page: Page, changes = 2) {
  await login(page);
  const suffix = randomUUID().slice(0, 8),
    root = await api(page, '/folders', 'POST', { name: '版本-' + suffix, parentId: '' });
  const file = await api(page, '/text', 'POST', {
    name: 'version-' + suffix + '.txt',
    parentId: root.id,
    key: randomUUID(),
    text: 'old <script>sentinel</script>',
  });
  for (let i = 0; i < changes; i++)
    await api(page, '/' + String(file.id) + '/text', 'PUT', {
      expectedRevision: i + 1,
      text: 'content-' + String(i + 2),
    });
  await page.goto('/home?parent=' + String(root.id));
  await expect(page.locator('[data-file-item="' + String(file.id) + '"]')).toBeVisible();
  return { root, file, suffix };
}
async function action(page: Page, name: unknown, label: string) {
  await page.getByRole('button', { name: String(name) + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).click();
}
async function open(page: Page, name: unknown) {
  await action(page, name, '版本历史');
  await expect(page.locator('[data-file-version]').first()).toBeVisible();
}
const version = (page: Page, n: number) => page.locator('[data-file-version="' + String(n) + '"]');
async function confirm(page: Page, title: string) {
  await page
    .getByRole('dialog', { name: title, exact: true })
    .getByRole('button', { name: '确认', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: title, exact: true })).toHaveCount(0);
}
async function close(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('版本时间线、分页、排序、原属性、当前标识和窄屏', async ({ page }) => {
  const f = await fixture(page, 6);
  await open(page, f.file.name);
  await expect(version(page, 7).getByText('当前版本', { exact: true })).toBeVisible();
  await expect(page.locator('[data-file-version]')).toHaveCount(5);
  await expect(page.getByText(/当前.*历史.*账号历史/)).toBeVisible();
  await page.getByRole('button', { name: '下一页版本', exact: true }).click();
  await expect(version(page, 1)).toBeVisible();
  await expect(version(page, 1).getByText(/原名称/)).toContainText(String(f.file.name));
  await page.getByRole('button', { name: '最新在前 版本顺序', exact: true }).click();
  await page.getByRole('option', { name: '最早在前', exact: true }).click();
  await expect(page.locator('[data-file-version]').first()).toHaveAttribute(
    'data-file-version',
    '1',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ animations: 'disabled', path: '../.data/128-history-mobile.png' });
  await close(page);
});
test('历史纯文本、并排比较和真实下载', async ({ page }) => {
  const f = await fixture(page);
  await open(page, f.file.name);
  await version(page, 1).getByRole('button', { name: '预览此版本', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: '版本 1 内容', exact: true }).locator('pre'),
  ).toHaveText('old <script>sentinel</script>');
  await page.getByRole('button', { name: '关闭版本预览', exact: true }).click();
  await version(page, 1).getByRole('button', { name: '与当前内容比较', exact: true }).click();
  const compare = page.getByRole('dialog', { name: '新旧内容并排比较', exact: true });
  await expect(compare.locator('pre')).toHaveCount(2);
  await expect(compare.locator('pre').nth(1)).toHaveText('content-3');
  await page.screenshot({ animations: 'disabled', path: '../.data/128-history-compare.png' });
  await page.getByRole('button', { name: '关闭版本预览', exact: true }).click();
  const download = page.waitForEvent('download');
  await version(page, 1).getByRole('button', { name: '下载此版本', exact: true }).click();
  expect((await download).suggestedFilename()).toBe(f.file.name);
  await close(page);
});
test('并发冲突保留确认，刷新后恢复提升', async ({ page }) => {
  const f = await fixture(page);
  await open(page, f.file.name);
  await version(page, 1).getByRole('button', { name: '恢复此版本', exact: true }).click();
  await api(page, '/' + String(f.file.id) + '/text', 'PUT', {
    expectedRevision: 3,
    text: 'concurrent',
  });
  const dialog = page.getByRole('dialog', { name: '恢复此版本', exact: true });
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '放弃选择并刷新', exact: true }).click();
  await expect(version(page, 4)).toBeVisible();
  await version(page, 1).getByRole('button', { name: '恢复此版本', exact: true }).click();
  await confirm(page, '恢复此版本');
  await expect(version(page, 5).getByText('当前版本', { exact: true })).toBeVisible();
  await expect(version(page, 1)).toHaveCount(0);
  await expect(version(page, 4)).toBeVisible();
  await close(page);
});
test('旧版另存、单项删除与清空保护当前', async ({ page }) => {
  const f = await fixture(page);
  await open(page, f.file.name);
  await version(page, 1).getByRole('button', { name: '旧版另存为', exact: true }).click();
  await page.getByLabel('新文件名称', { exact: true }).fill('saved-' + f.suffix + '.txt');
  await confirm(page, '旧版另存为');
  await expect(version(page, 1)).toBeVisible();
  await version(page, 1).getByRole('button', { name: '删除历史版本', exact: true }).click();
  await confirm(page, '删除所选历史版本');
  await expect(version(page, 1)).toHaveCount(0);
  await page.getByRole('button', { name: '清空全部历史版本', exact: true }).click();
  await confirm(page, '删除所选历史版本');
  await expect(page.locator('[data-file-version]')).toHaveCount(1);
  await expect(version(page, 3)).toBeVisible();
  await close(page);
  await expect(
    page.getByRole('button', { name: 'saved-' + f.suffix + '.txt', exact: true }),
  ).toBeVisible();
});
test('跨页选择历史并批量清理不误删当前', async ({ page }) => {
  const f = await fixture(page, 6);
  await open(page, f.file.name);
  await page.getByRole('checkbox', { name: '选择版本 6', exact: true }).press('Space');
  await page.getByRole('button', { name: '下一页版本', exact: true }).click();
  await expect(version(page, 1)).toBeVisible();
  await page.getByRole('checkbox', { name: '选择版本 1', exact: true }).press('Space');
  await expect(page.getByText('已选择 2 个历史版本', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '删除所选历史版本', exact: true }).click();
  await confirm(page, '删除所选历史版本');
  await expect(version(page, 7)).toBeVisible();
  const listed = await api(page, '/' + String(f.file.id) + '/versions');
  expect(listed.total).toBe(5);
  await close(page);
});
test('上传新版本复用真实 tus，媒体旧版可预览', async ({ page }) => {
  const f = await fixture(page, 0);
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d');
    if (!ctx) throw Error('canvas');
    ctx.fillRect(0, 0, 16, 16);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  const chooser = page.waitForEvent('filechooser');
  await action(page, f.file.name, '上传新版本');
  await (
    await chooser
  ).setFiles({
    name: 'different-source.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.getByText('上传完成', { exact: true })).toHaveCount(1);
  const history = await api(page, '/' + String(f.file.id) + '/versions');
  expect(history.total).toBe(2);
  expect((history.entry as { name: string }).name).toBe(f.file.name);
  await api(page, '/' + String(f.file.id) + '/text', 'PUT', {
    expectedRevision: 2,
    text: 'new text',
  });
  await page.reload();
  await open(page, f.file.name);
  await version(page, 2).getByRole('button', { name: '预览此版本', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: '版本 2 内容', exact: true }).locator('img'),
  ).toBeVisible();
  await page.getByRole('button', { name: '关闭版本预览', exact: true }).click();
  await close(page);
});
test('目录复制历史独立，改名移动和回收恢复保留', async ({ page }) => {
  const f = await fixture(page);
  const copy = await api(page, '/' + String(f.root.id) + '/copy', 'POST', {
    parentId: '',
    name: 'copied-' + f.suffix,
  });
  const copied = (await api(page, '?parent=' + String(copy.id))).items as { id: string }[];
  const copiedId = copied[0]!.id;
  expect((await api(page, '/' + copiedId + '/versions')).total).toBe(3);
  await api(page, '/' + String(f.file.id) + '/versions', 'DELETE', {
    mode: 'all-history',
    revisions: [],
    expectedContentRevision: 3,
    expectedHistoryRevision: 2,
  });
  expect((await api(page, '/' + copiedId + '/versions')).total).toBe(3);
  await api(page, '/' + copiedId, 'PATCH', {
    name: 'renamed-' + f.suffix + '.txt',
    parentId: f.root.id,
  });
  await api(page, '/' + String(f.root.id) + '/trash', 'POST');
  await api(page, '/' + String(f.root.id) + '/restore', 'POST', {});
  await page.goto('/home?parent=' + String(f.root.id));
  await open(page, 'renamed-' + f.suffix + '.txt');
  await expect(page.locator('[data-file-version]')).toHaveCount(3);
  await close(page);
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

test('历史音视频实际解码播放，关闭释放媒体资源', async ({ page }) => {
  const f = await fixture(page, 0);
  const video = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('canvas');
    ctx.fillRect(0, 0, 80, 80);
    const stream = canvas.captureStream(10);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start();
    const timer = setInterval(() => ctx.fillRect(0, 0, 80, 80), 60);
    await new Promise((resolve) => setTimeout(resolve, 700));
    recorder.stop();
    await done;
    clearInterval(timer);
    for (const t of stream.getTracks()) t.stop();
    return Array.from(new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()));
  });
  for (const [kind, mime, buffer] of [
    ['audio', 'audio/wav', waveFixture()],
    ['video', 'video/webm', Buffer.from(video)],
  ] as const) {
    const target = await api(page, '/text', 'POST', {
      name: kind + '-' + f.suffix + '.txt',
      parentId: f.root.id,
      key: randomUUID(),
      text: 'initial',
    });
    await page.reload();
    const chooser = page.waitForEvent('filechooser');
    await action(page, target.name, '上传新版本');
    await (
      await chooser
    ).setFiles({ name: 'source.' + (kind === 'audio' ? 'wav' : 'webm'), mimeType: mime, buffer });
    await expect(
      page.locator('[data-transfer-id]').filter({ hasText: String(target.name) }),
    ).toContainText('上传完成');
    await api(page, '/' + String(target.id) + '/text', 'PUT', {
      expectedRevision: 2,
      text: 'new current',
    });
    await page.reload();
    await open(page, target.name);
    await version(page, 2).getByRole('button', { name: '预览此版本', exact: true }).click();
    const player = page.getByRole('dialog', { name: '版本 2 内容', exact: true }).locator(kind);
    await expect(player).toBeVisible();
    await expect
      .poll(() => player.evaluate((node: HTMLMediaElement) => node.readyState))
      .toBeGreaterThan(0);
    await player.evaluate(async (node: HTMLMediaElement) => {
      node.muted = true;
      await node.play();
    });
    await expect
      .poll(() => player.evaluate((node: HTMLMediaElement) => node.currentTime))
      .toBeGreaterThan(0);
    const owned = await player.elementHandle();
    await page.getByRole('button', { name: '关闭版本预览', exact: true }).click();
    if (!owned) throw Error('player');
    expect(
      await owned.evaluate((node: HTMLMediaElement) => node.paused && !node.hasAttribute('src')),
    ).toBe(true);
    await owned.dispose();
    await close(page);
  }
});
test('替换任务暂停刷新重选，目标 CAS 保留且不允许改投', async ({ page }) => {
  test.setTimeout(180_000);
  const f = await fixture(page, 0),
    source = {
      name: 'replacement-source.bin',
      mimeType: 'application/octet-stream',
      buffer: Buffer.alloc(9 * 1024 * 1024, 87),
    };
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let chunks = 0;
  await page.route('**/native/files/transfers/*/data', async (route) => {
    if (route.request().method() === 'PATCH' && ++chunks === 2) await gate;
    await route.continue();
  });
  try {
    const chooser = page.waitForEvent('filechooser');
    await action(page, f.file.name, '上传新版本');
    await (await chooser).setFiles(source);
    await expect.poll(() => chunks).toBeGreaterThanOrEqual(2);
    await page.getByRole('link', { name: '传输中心', exact: true }).first().click();
    const row = page.locator('[data-transfer-id]').filter({ hasText: String(f.file.name) });
    await row.getByRole('button', { name: '暂停', exact: true }).click();
    await expect(row).toContainText('已暂停');
    release();
    await page.reload();
    await expect(row).toContainText('需要重新选择源文件');
    await expect(row.getByRole('button', { name: '修改目标', exact: true })).toHaveCount(0);
    const reselect = page.waitForEvent('filechooser');
    await row.getByRole('button', { name: '重新选择源文件', exact: true }).click();
    await (await reselect).setFiles(source);
    await expect(row).toContainText('上传完成', { timeout: 60_000 });
    expect((await api(page, '/' + String(f.file.id) + '/versions')).total).toBe(2);
  } finally {
    release();
    await page.unroute('**/native/files/transfers/*/data');
  }
});
