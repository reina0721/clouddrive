import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

/** 配置与用例共用同一个本地预览凭据入口，不把某次验收端口写成产品契约。 */
export function readPreviewAccess() {
  const frontend = resolve(__dirname, '..');
  const current = resolve(frontend, '../.data/preview/access.json');
  const path = process.env.CLOUDDRIVE_FILE_TEST_ACCESS
    ? resolve(frontend, process.env.CLOUDDRIVE_FILE_TEST_ACCESS)
    : existsSync(current)
      ? current
      : resolve(frontend, '../.data/preview-access.json');
  const access: unknown = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  if (
    typeof access !== 'object' ||
    !access ||
    !('url' in access) ||
    typeof access.url !== 'string' ||
    !('username' in access) ||
    typeof access.username !== 'string' ||
    !access.username ||
    !('password' in access) ||
    typeof access.password !== 'string' ||
    !access.password
  )
    throw new Error('Run node scripts/dev.mjs --preview to prepare isolated preview access.');
  const url = new URL(access.url);
  if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || url.username || url.password)
    throw new Error('Files browser tests require a local loopback preview.');
  return {
    path,
    url: access.url,
    origin: url.origin,
    username: access.username,
    password: access.password,
  };
}

export async function openReadingFixtureFolder(page: Page, prefix: string) {
  const id = await page.evaluate(
    async (name) => {
      const csrf = await fetch('/api/console/v1/auth/csrf');
      if (!csrf.ok) throw new Error('Reading fixture CSRF HTTP ' + csrf.status);
      const { token } = (await csrf.json()) as { token: string };
      const response = await fetch('/api/console/v1/native/files/folders', {
        method: 'POST',
        headers: { 'X-CSRF-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: '', name }),
      });
      if (!response.ok) throw new Error('Reading fixture folder HTTP ' + response.status);
      return ((await response.json()) as { id: string }).id;
    },
    prefix + randomUUID().slice(0, 8),
  );
  await page.goto('/home?parent=' + encodeURIComponent(id));
}
