import { expect, test } from '@playwright/test';
import { readPreviewAccess } from './reading-fixture';

test.use({ actionTimeout: 15_000 });

test('真实管理导航在桌面和移动抽屉中显示当前项', async ({ page }, info) => {
  const access = readPreviewAccess();
  await page.setViewportSize({ width: 1440, height: 900 });
  const loaded = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith('/native/files/worker-nodes') &&
      response.request().method() === 'GET',
  );
  await page.goto('/login?returnTo=%2Fsystem-tools%2Fnodes');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  expect((await loaded).ok()).toBe(true);
  const nav = page.getByRole('navigation', { name: '主导航', exact: true });
  const current = nav.locator('a[aria-current="page"]');
  await expect(current).toHaveAttribute('href', '/system-tools/nodes');
  await expect(current).toBeInViewport();
  await expect(current).not.toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await nav.screenshot({
    path: info.outputPath('management-current-desktop.png'),
    animations: 'disabled',
  });

  await page.setViewportSize({ width: 320, height: 760 });
  await page.getByRole('button', { name: '打开导航', exact: true }).click();
  await expect(current).toBeInViewport();
  await expect(current).not.toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: info.outputPath('management-current-mobile.png'),
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '关闭导航', exact: true }).click();
  await expect(page.getByRole('button', { name: '打开导航', exact: true })).toBeFocused();
});
