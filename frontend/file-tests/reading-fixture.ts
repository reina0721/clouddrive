import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';

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
