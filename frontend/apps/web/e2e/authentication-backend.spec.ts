import { test, expect } from '@playwright/test';
import { e2eBackendBaseUrl } from './base-url';
import AxeBuilder from '@axe-core/playwright';

// Controlled proposed API responses validate the real Backend adapter and UI.
// This is not evidence of integration with an actual authentication server.
test('Backend mode uses CSRF/session API for login, restore and logout without Mock persistence', async ({
  page,
  context,
}) => {
  let authenticated = false;
  const writes: { path: string; csrf: string | undefined; body: string | null }[] = [];
  await context.route('**/api/auth/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/csrf') {
      await route.fulfill({ json: { token: 'contract-csrf' } });
    } else if (path === '/api/auth/session') {
      await route.fulfill(
        authenticated
          ? {
              json: {
                user: {
                  id: 'backend-review',
                  name: 'Backend Review',
                  email: 'backend@example.test',
                },
                expiresAt: Date.now() + 60_000,
              },
            }
          : { status: 401 },
      );
    } else if (path === '/api/auth/access' && request.method() === 'GET') {
      await route.fulfill(
        authenticated
          ? {
              json: {
                user: {
                  id: 'backend-review',
                  name: 'Backend Review',
                  email: 'backend@example.test',
                  status: 'active',
                  roleIds: ['viewer'],
                  version: 1,
                  createdAt: '2026-10-12T00:00:00.000Z',
                  updatedAt: '2026-10-12T00:00:00.000Z',
                },
                permissions: ['account.update'],
              },
            }
          : { status: 401 },
      );
    } else if (
      request.method() === 'POST' &&
      (path === '/api/auth/login' || path === '/api/auth/logout')
    ) {
      writes.push({ path, csrf: request.headers()['x-csrf-token'], body: request.postData() });
      authenticated = path !== '/api/auth/logout';
      await route.fulfill({ status: 204 });
    } else {
      throw new Error(`Unexpected authentication request: ${request.method()} ${path}`);
    }
  });
  // The first Backend login route may still be compiling in the dev host. Observe
  // its actual RSC response before measuring the client's redirect completion.
  const loginRouteResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/login' && url.searchParams.has('_rsc');
  });
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  expect((await loginRouteResponse).ok()).toBe(true);
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.getByText('开发演示模式', { exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('backend@example.test');
  await page.getByLabel('密码', { exact: true }).fill('BackendDemoPass2026!');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(`${e2eBackendBaseUrl}/settings`);
  await page.reload();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await expect(page.getByRole('menu').getByText('Backend Review', { exact: true })).toBeVisible();
  const otherTab = await context.newPage();
  await otherTab.goto(`${e2eBackendBaseUrl}/settings`);
  await expect(otherTab.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(`${e2eBackendBaseUrl}/login`);
  await expect(otherTab).toHaveURL(/\/login\?returnTo=/);
  await expect(otherTab.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  await otherTab.close();
  expect(writes.map((write) => write.path)).toEqual(['/api/auth/login', '/api/auth/logout']);
  expect(writes.every((write) => write.csrf === 'contract-csrf')).toBe(true);
  expect(writes[0]?.body).toBe(
    JSON.stringify({ email: 'backend@example.test', password: 'BackendDemoPass2026!' }),
  );
  expect(await page.evaluate(() => localStorage.getItem('clouddrive.auth-mock'))).toBeNull();
});

test('Backend restore failure stays closed, supports retry and never supplies a demo identity', async ({
  page,
  context,
}) => {
  let healthy = false;
  await context.route('**/api/auth/session', async (route) => {
    if (!healthy) await route.abort('failed');
    else await route.fulfill({ status: 401 });
  });
  await page.goto('/reference-resources');
  await expect(
    page.getByText('无法连接认证服务，请检查网络后重试。', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  await expect(page.getByText('开发演示模式', { exact: true })).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
  healthy = true;
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  expect(await page.evaluate(() => localStorage.getItem('clouddrive.auth-mock'))).toBeNull();
});

test('Backend registration reports pending/success and failed logout keeps all private content hidden', async ({
  page,
  context,
}) => {
  let authenticated = false;
  let rejectLogout = true;
  let completeRegistration: (() => void) | undefined;
  const registration = new Promise<void>((resolve) => {
    completeRegistration = resolve;
  });
  await context.route('**/api/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/csrf') await route.fulfill({ json: { token: 'register-csrf' } });
    else if (path === '/api/auth/registration-policy')
      await route.fulfill({ json: { enabled: true } });
    else if (path === '/api/auth/session')
      await route.fulfill(
        authenticated
          ? {
              json: {
                user: { id: 'new-backend', name: 'New Backend', email: 'new-backend@example.test' },
                expiresAt: Date.now() + 60_000,
              },
            }
          : { status: 401 },
      );
    else if (path === '/api/auth/register') {
      await registration;
      authenticated = true;
      expect(route.request().postData()).toBe(
        JSON.stringify({
          email: 'new-backend@example.test',
          password: 'BackendRegister2026!',
          name: 'New Backend',
        }),
      );
      await route.fulfill({ status: 204 });
    } else if (path === '/api/auth/logout') {
      if (rejectLogout) await route.fulfill({ status: 503 });
      else {
        authenticated = false;
        await route.fulfill({ status: 204 });
      }
    } else await route.fulfill({ status: 404 });
  });
  await page.goto('/register');
  await page.getByRole('textbox', { name: '姓名', exact: true }).fill('New Backend');
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('new-backend@example.test');
  await page.getByLabel('密码', { exact: true }).fill('BackendRegister2026!');
  await page.getByLabel('确认密码', { exact: true }).fill('BackendRegister2026!');
  await page.getByRole('button', { name: '创建账户', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '姓名', exact: true })).toBeDisabled();
  completeRegistration?.();
  await expect(page.getByText('账户已创建', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '继续进入工作台', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  await expect(
    page.getByText('认证服务或本地存储暂时不可用，请稍后重试。', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  rejectLogout = false;
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
});
