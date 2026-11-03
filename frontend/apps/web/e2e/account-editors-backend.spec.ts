import { test, expect } from '@playwright/test';
import { installProductBackend } from './product-backend-fixture';

test('Pending inline profile submission blocks editing and duplicate native submits', async ({
  page,
  context,
}) => {
  const fixture = await installProductBackend(context);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await context.route('**/api/me', async (route) => {
    if (route.request().method() === 'PATCH') {
      requests += 1;
      await gate;
    }
    await route.fallback();
  });
  try {
    await page.goto('/account');
    const form = page.getByRole('main').locator('form').first();
    await form.getByLabel('姓名', { exact: true }).fill('Pending inline profile');
    await form.getByRole('button', { name: '保存资料', exact: true }).click();
    await expect.poll(() => requests).toBe(1);
    await expect(form.getByRole('button', { name: '重置', exact: true })).toBeDisabled();
    await expect(form.getByRole('button', { name: '保存资料', exact: true })).toBeDisabled();
    await expect(form.getByLabel('姓名', { exact: true })).toBeDisabled();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await form.evaluate((element: HTMLFormElement) => {
      element.requestSubmit();
      element.requestSubmit();
    });
    expect(requests).toBe(1);
    release();
    await expect(form.getByRole('button', { name: '保存资料', exact: true })).toBeEnabled();
    await expect(form.getByLabel('姓名', { exact: true })).toHaveValue('Pending inline profile');
    expect(fixture.writes.filter((write) => write.path === '/me')).toHaveLength(1);
  } finally {
    release();
  }
});
