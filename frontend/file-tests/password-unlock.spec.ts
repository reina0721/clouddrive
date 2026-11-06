import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

async function access(path = process.env.CLOUDDRIVE_FILE_TEST_ACCESS) {
  if (!path) throw Error('需要隔离QA账号');
  const value = JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as {
    url: string;
    username: string;
    password: string;
  };
  if (new URL(value.url).origin !== 'http://127.0.0.1:4194') throw Error('只允许隔离QA');
  return value;
}
async function login(page: Page, path?: string) {
  const account = await access(path);
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  return account;
}
async function lock(page: Page) {
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /锁定屏幕/ }).click();
  const panel = page.getByRole('dialog', { name: '锁屏', exact: true });
  await expect(panel).toBeVisible();
  return panel;
}

test('F421–431：本人真实密码、错误后重试、会话不变、空输入和刷新持久', async ({ page }, info) => {
  const account = await login(page);
  const sessionBefore = (await page.request
    .get('/api/console/v1/auth/session')
    .then((r) => r.json())) as { sessionId: string };
  let count = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/auth/password/verify')) count++;
  });
  let panel = await lock(page);
  await panel.getByRole('button', { name: '解锁', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('请输入密码');
  expect(count).toBe(0);
  await panel.getByLabel('账号密码', { exact: true }).fill('incorrect');
  await panel.getByLabel('账号密码', { exact: true }).press('Enter');
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(panel.getByLabel('账号密码', { exact: true })).toHaveValue('');
  const sessionAfter = (await page.request
    .get('/api/console/v1/auth/session')
    .then((r) => r.json())) as { sessionId: string };
  expect(sessionAfter.sessionId).toBe(sessionBefore.sessionId);
  await page.reload();
  panel = page.getByRole('dialog', { name: '锁屏', exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel('账号密码', { exact: true })).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('password-unlock-chinese.png') });
  await panel.getByLabel('账号密码', { exact: true }).fill(account.password);
  await panel.getByLabel('账号密码', { exact: true }).press('Enter');
  await expect(panel).toHaveCount(0);
  expect(count).toBe(2);
  await expect(page.getByRole('button', { name: '新建', exact: true })).toBeEnabled();
});

test('F429、438–439：重复提交、断网恢复及退出后的迟到结果', async ({ page }) => {
  const account = await login(page);
  let panel = await lock(page);
  await page.route('**/auth/password/verify', (route) => route.abort('internetdisconnected'));
  await panel.getByLabel('账号密码', { exact: true }).fill(account.password);
  await panel.getByRole('button', { name: '解锁', exact: true }).click();
  await expect(panel.getByRole('alert')).toBeVisible();
  await page.unroute('**/auth/password/verify');
  let release: () => void = () => {};
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let count = 0;
  let settled: () => void = () => {};
  const completed = new Promise<void>((resolve) => {
    settled = resolve;
  });
  await page.route('**/auth/password/verify', async (route) => {
    count++;
    await blocked;
    try {
      await route.continue();
    } catch (error) {
      // 客户端取消后Playwright可已处理该路由；只接受这一种预期取消，其他错误必须失败。
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Route is already handled!');
    } finally {
      settled();
    }
  });
  await panel.getByLabel('账号密码', { exact: true }).fill(account.password);
  await panel.getByRole('button', { name: '解锁', exact: true }).click();
  await expect(panel.getByRole('button', { name: '正在验证…', exact: true })).toBeDisabled();
  await panel.getByLabel('账号密码', { exact: true }).press('Enter');
  expect(count).toBe(1);
  await panel.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  if (!process.env.CLOUDDRIVE_FILE_TEST_SECOND_ACCESS) throw Error('需要第二个隔离QA账号');
  const second = await login(page, process.env.CLOUDDRIVE_FILE_TEST_SECOND_ACCESS);
  expect(second.username).not.toBe(account.username);
  panel = await lock(page);
  release();
  await completed;
  await page.unroute('**/auth/password/verify');
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel('账号密码', { exact: true })).toHaveValue('');
  await panel.getByLabel('账号密码', { exact: true }).fill(second.password);
  await panel.getByRole('button', { name: '解锁', exact: true }).click();
  await expect(panel).toHaveCount(0);
});

test('F440：320px英文深色、错误反馈可见及退出', async ({ page }, info) => {
  await login(page);
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.goto('/settings/locale');
  await page
    .getByRole('radiogroup', { name: '界面语言', exact: true })
    .getByText('English', { exact: true })
    .click();
  await page.goto('/home');
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole('button', { name: 'Current user', exact: true }).click();
  await page.getByRole('menuitem', { name: /Lock screen/ }).click();
  const panel = page.getByRole('dialog', { name: 'Locked', exact: true });
  await panel.getByLabel('Account password', { exact: true }).fill('incorrect');
  await panel.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(panel.getByRole('alert')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('password-unlock-mobile-dark-english.png') });
  await panel.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
});
