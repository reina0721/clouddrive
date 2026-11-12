import { expect, type Page, type Locator } from '@playwright/test';
import { readPreviewAccess } from './reading-fixture';

export async function loginStorage(page: Page, account = readPreviewAccess()) {
  await page.goto('/login?returnTo=%2Fsystem-tools%2Fstorage');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '存储策略', exact: true })).toBeVisible();
}
export async function storageRequest<T>(
  page: Page,
  suffix = '',
  method = 'GET',
  body?: unknown,
): Promise<T> {
  return page.evaluate(
    async ({ suffix, method, body }) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (method !== 'GET') {
        const csrf = await fetch('/api/console/v1/auth/csrf');
        if (!csrf.ok) throw new Error('Storage fixture CSRF HTTP ' + csrf.status);
        headers['X-CSRF-Token'] = ((await csrf.json()) as { token: string }).token;
      }
      const response = await fetch('/api/console/v1/native/files/storage-policy' + suffix, {
        method,
        headers,
        cache: 'no-store',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new Error('Storage fixture HTTP ' + response.status);
      return (await response.json()) as unknown;
    },
    { suffix, method, body },
  ) as Promise<T>;
}
export function storageSection(page: Page, name: string) {
  return page
    .getByRole('main')
    .locator('section')
    .filter({ has: page.getByRole('heading', { name, exact: true, level: 2 }) });
}
export async function selectStorageUnit(page: Page, scope: Locator, name: string, unit: string) {
  await scope.getByRole('button', { name: new RegExp(name + '单位') }).click();
  await page.getByRole('option', { name: unit, exact: true }).click();
}
export async function customizeLimit(
  page: Page,
  dialog: Locator,
  name: string,
  amount: string,
  unit = 'MiB',
) {
  const field = dialog.getByRole('group', { name, exact: true });
  const inherit = field.getByRole('checkbox');
  if (await inherit.isChecked()) await inherit.press('Space');
  await selectStorageUnit(page, field, name, unit);
  await field.getByRole('textbox', { name, exact: true }).fill(amount);
  return field;
}
