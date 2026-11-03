import { test, expect, type Page } from '@playwright/test';

/** 快捷偏好抽屉、水印、锁屏、布局模式的产品级验收。 */

async function openDrawer(page: Page) {
  await page.getByRole('button', { name: '快捷偏好设置', exact: true }).click();
  const drawer = page.getByRole('dialog').first();
  await expect(drawer.getByRole('heading', { name: '快捷偏好设置', exact: true })).toBeVisible();
  return drawer;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
});

test('quick preferences drawer toggles watermark and layout with immediate effect', async ({
  page,
}) => {
  const drawer = await openDrawer(page);

  // Switch/Radio 的 input 被 label 包裹：用键盘激活，避免点击被内容层拦截。
  const watermark = drawer.getByRole('switch', { name: '显示水印', exact: true });
  await watermark.focus();
  await watermark.press('Space');
  await expect(page.locator('[data-shell-watermark]')).toBeVisible();
  await expect(page.locator('[data-shell-watermark]')).toHaveAttribute('aria-hidden', 'true');

  const topNav = drawer.getByRole('radio', { name: /顶部导航/ });
  await topNav.focus();
  await topNav.press('Space');
  await expect(page.locator('.surface-shell-grid')).toHaveAttribute('data-layout', 'horizontal');
  await page.keyboard.press('Escape');

  await page.reload();
  // 偏好复用同一 store：刷新后仍是顶部导航 + 水印。
  await expect(page.locator('.surface-shell-grid')).toHaveAttribute('data-layout', 'horizontal');
  await expect(page.locator('[data-shell-watermark]')).toBeVisible();

  // 还原默认，避免污染同一浏览器上下文中的后续用例。
  const reopened = await openDrawer(page);
  await reopened.getByRole('button', { name: '恢复默认偏好', exact: true }).click();
  await page.getByRole('button', { name: '恢复默认', exact: true }).click();
  await expect(page.locator('[data-shell-watermark]')).toHaveCount(0);
});

test('lock screen blocks content and requires the account password to unlock', async ({ page }) => {
  await page.getByRole('button', { name: '锁定屏幕', exact: true }).click();
  const lock = page.getByRole('dialog', { name: '锁屏' });
  await expect(lock).toBeVisible();
  await expect(page.locator('#main-content')).toHaveAttribute('inert', '');

  await lock.getByLabel('账号密码', { exact: true }).fill('wrong-password');
  await lock.getByRole('button', { name: '解锁', exact: true }).click();
  await expect(lock.getByText('密码复核未通过，内容保持锁定。')).toBeVisible();
  // 输错密码不能把会话踢掉（解锁不是 auth.login）。
  await expect(page).toHaveURL(/\/$/);
  await expect(lock).toBeVisible();

  await lock.getByLabel('账号密码', { exact: true }).fill('CommunityDemo2026!');
  await lock.getByRole('button', { name: '解锁', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '锁屏' })).toHaveCount(0);
  await expect(page.locator('#main-content')).not.toHaveAttribute('inert', '');
});
