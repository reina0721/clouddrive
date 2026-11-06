import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

test('发布临时繁忙自动恢复，耗尽后仍可手动完成且字节不重复', async ({ page }) => {
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
  const folder = await page.evaluate(
    async (name) => {
      const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
      const response = await fetch('/api/console/v1/native/files/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        body: JSON.stringify({ parentId: '', name }),
      });
      if (!response.ok) throw Error('Real publication fixture failed');
      return (await response.json()) as { id: string };
    },
    '发布恢复-' + randomUUID().slice(0, 8),
  );
  await page.goto('/home?parent=' + folder.id);
  let attempts = 0,
    admissions = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/console/v1/native/files/transfers'
    )
      admissions++;
  });
  const bytes = Buffer.from('真实发布恢复内容，分块只上传一次。');
  for (const busyResponses of [2, 4]) {
    attempts = 0;
    await page.route('**/native/files/transfers/*/commit', async (route) => {
      if (++attempts <= busyResponses)
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'files_busy', message: 'files_busy' }),
        });
      else await route.continue();
    });
    const name = 'publication-' + busyResponses + '.txt';
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: '新建', exact: true }).click();
    await page.getByRole('menuitem', { name: '上传文件', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '使用此位置', exact: true }).click();
    await (await chooser).setFiles({ name, mimeType: 'text/plain', buffer: bytes });
    const row = page.locator('[data-transfer-id]').filter({ hasText: name });
    if (busyResponses === 4) {
      await expect(row).toContainText('传输通道繁忙，请稍后重试。');
      expect(attempts).toBe(4);
      await page.unroute('**/native/files/transfers/*/commit');
      await row.getByRole('button', { name: '完成保存', exact: true }).click();
    }
    await expect(row).toContainText('上传完成');
    if (busyResponses === 2) expect(attempts).toBe(3);
    await page.unroute('**/native/files/transfers/*/commit');
    await page
      .getByRole('dialog', { name: '上传队列', exact: true })
      .getByRole('button', { name: '关闭', exact: true })
      .click();
  }
  expect(admissions).toBe(2);
  const received = await page.evaluate(async (parent) => {
    const listing = (await (
      await fetch(
        '/api/console/v1/native/files?' +
          new URLSearchParams({ parent, page: '1', pageSize: '50' }).toString(),
      )
    ).json()) as { items: { id: string; name: string }[] };
    return await Promise.all(
      listing.items.map(async (entry) => {
        const response = await fetch('/api/console/v1/native/files/' + entry.id + '/content');
        if (!response.ok) throw Error('Published bytes unavailable');
        return {
          name: entry.name,
          bytes: Array.from(new Uint8Array(await response.arrayBuffer())),
        };
      }),
    );
  }, folder.id);
  expect(received.map((entry) => entry.name).sort()).toEqual([
    'publication-2.txt',
    'publication-4.txt',
  ]);
  for (const entry of received) expect(Buffer.from(entry.bytes)).toEqual(bytes);
});
