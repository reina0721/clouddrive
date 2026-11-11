import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readPreviewAccess } from './reading-fixture';

test.use({ actionTimeout: 15_000 });

async function login(page: Page, credentials = readPreviewAccess()) {
  await page.goto('/login?returnTo=%2Fworkspace');
  await page.getByLabel('邮箱', { exact: true }).fill(credentials.username);
  await page.getByLabel('密码', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole('heading', { name: '管理概览', exact: true })).toBeVisible();
}

async function write(page: Page, path: string, method: string, body: unknown) {
  const result = await page.evaluate(
    async ({ path, method, body }) => {
      const csrf = await fetch('/api/console/v1/auth/csrf');
      if (!csrf.ok) throw new Error('Management fixture CSRF HTTP ' + csrf.status);
      const { token } = (await csrf.json()) as { token: string };
      const response = await fetch('/api/console/v1' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify(body),
      });
      return { status: response.status, value: (await response.json()) as Record<string, unknown> };
    },
    { path, method, body },
  );
  expect(result.status, '真实管理 API 应接受隔离验收数据').toBe(200);
  return result.value;
}

async function member(page: Page, permissionKeys: string[]) {
  const suffix = randomUUID().slice(0, 8);
  const role = (
    await write(page, '/roles', 'POST', { name: '管理体验-' + suffix, permissions: [] })
  ).role as { id: string };
  await write(page, '/native/iam/roles/' + role.id + '/permissions', 'PUT', {
    expectedRoleVersion: 1,
    permissionKeys,
  });
  const access = readPreviewAccess();
  const credentials = {
    ...access,
    username: 'management-' + suffix + '@clouddrive.test',
    password: randomUUID(),
  };
  await write(page, '/users', 'POST', {
    email: credentials.username,
    password: credentials.password,
    name: '管理体验-' + suffix,
    roleIds: [role.id],
    status: 'active',
  });
  return credentials;
}

async function accessible(page: Page) {
  await expect
    .poll(
      async () =>
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    )
    .toEqual([]);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

test('管理概览串联真实入口、文件返回与待办创建完成', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  const main = page.getByRole('main');
  for (const name of ['文件与协作', '身份与访问', '任务与运行', '站点设置'])
    await expect(main.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(main.locator('a[href="/system-tools/storage"]')).toHaveCount(1);
  await expect(main.locator('a[href="/users"]')).toHaveCount(1);
  await expect(page.locator('nav a[href="/"]')).toHaveCount(0);
  await expect(page.locator('nav a[href="/workspace"]').first()).toContainText('管理概览');
  await main.getByRole('button', { name: '添加待办', exact: true }).click();
  const create = page.getByRole('dialog', { name: '添加待办', exact: true });
  await expect(create.getByRole('button', { name: '确认', exact: true })).toBeDisabled();
  const title = '复核访问规则-' + randomUUID().slice(0, 8);
  await create.getByRole('textbox').fill('  ' + title + '  ');
  await create.getByRole('button', { name: '确认', exact: true }).click();
  await expect(create).toHaveCount(0);
  const row = main.getByRole('row').filter({ has: page.getByText(title, { exact: true }) });
  await expect(row).toContainText('待完成');
  await row.getByRole('button', { name: '完成', exact: true }).click();
  const complete = page.getByRole('dialog', { name: '完成待办', exact: true });
  await complete.getByRole('button', { name: '确认', exact: true }).click();
  await expect(complete).toHaveCount(0);
  await expect(row).toContainText('已完成');
  await expect(row.getByRole('button')).toHaveCount(0);
  await page.reload();
  await expect(row).toContainText('已完成');
  await accessible(page);
  await page.screenshot({ path: info.outputPath('management-desktop.png'), fullPage: true });
  await main.getByRole('link', { name: '返回我的文件', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: '我的文件', exact: true })).toBeVisible();
  await page.goto('/workspace');
  await main.locator('a[href="/users"]').click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('无管理权限与仅分享读取的账户看到一致入口，待办不发出越权请求', async ({ page, browser }) => {
  await login(page);
  for (const permissionKeys of [
    ['files:read'],
    ['files:read', 'files:share-admin:read'],
    ['organization:position:read'],
  ]) {
    const credentials = await member(page, permissionKeys);
    const context = await browser.newContext({
      baseURL: readPreviewAccess().origin,
      locale: 'zh-CN',
    });
    try {
      const visitor = await context.newPage();
      const todoRequests: string[] = [];
      visitor.on('request', (request) => {
        if (new URL(request.url()).pathname === '/api/console/v1/todos')
          todoRequests.push(request.url());
      });
      await login(visitor, credentials);
      const main = visitor.getByRole('main');
      if (permissionKeys.includes('files:share-admin:read')) {
        await expect(main.locator('a[href="/system-tools/shares"]')).toBeVisible();
        await expect(visitor.locator('nav a[href="/system-tools/shares"]').first()).toBeVisible();
      } else if (permissionKeys.includes('organization:position:read')) {
        await expect(main.locator('a[href="/system/departments/positions"]')).toBeVisible();
        await expect(main.getByRole('link', { name: '返回我的文件', exact: true })).toHaveCount(0);
      } else {
        await expect(main.getByText('当前账户没有可用的管理入口', { exact: true })).toBeVisible();
        await expect(visitor.locator('a[href="/system-tools/shares"]')).toHaveCount(0);
      }
      for (const path of ['tasks', 'nodes', 'storage'])
        await expect(visitor.locator('a[href="/system-tools/' + path + '"]')).toHaveCount(0);
      await expect(main.getByRole('heading', { name: '账户与角色', exact: true })).toHaveCount(0);
      await expect(main.getByRole('button', { name: '添加待办', exact: true })).toHaveCount(0);
      expect(todoRequests).toEqual([]);
    } finally {
      await context.close();
    }
  }
});

test('菜单延迟和读取失败不伪装为空权限，重试保留统一的隐藏与标题覆盖', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fail = true;
  await page.route('**/api/console/v1/navigation', async (route) => {
    await gate;
    if (fail) return route.fulfill({ status: 503, json: { error: { code: 'unavailable' } } });
    const response = await route.fetch();
    const value = (await response.json()) as {
      items: { id: string; label: string; enabled: boolean }[];
    };
    for (const item of value.items) {
      if (item.id === 'system-tools.storage') item.label = '存储规则与用量';
      if (item.id === 'system-tools.nodes') item.enabled = false;
    }
    await route.fulfill({ response, json: value });
  });
  await login(page);
  const main = page.getByRole('main');
  await expect(main.getByText('正在读取可用的管理入口…', { exact: true })).toBeVisible();
  await expect(main.getByText('当前账户没有可用的管理入口', { exact: true })).toHaveCount(0);
  release();
  await expect(main.getByText('暂时无法读取管理入口', { exact: true })).toBeVisible();
  fail = false;
  await main.getByRole('button', { name: '重试', exact: true }).click();
  await expect(main.getByRole('link', { name: /^存储规则与用量/ })).toBeVisible();
  await expect(page.locator('nav a[href="/system-tools/storage"]').first()).toContainText(
    '存储规则与用量',
  );
  await expect(page.locator('a[href="/system-tools/nodes"]')).toHaveCount(0);
  await expect(main.getByText('暂时无法读取管理入口', { exact: true })).toHaveCount(0);
});

test('320px 英文深色管理页可读、可用键盘并满足无障碍要求', async ({ page }, info) => {
  await login(page);
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible();
  await accessible(page);
  const link = page.getByRole('main').getByRole('link', { name: 'Back to my files', exact: true });
  await link.focus();
  await expect(link).toBeFocused();
  await page.screenshot({
    path: info.outputPath('management-mobile-dark-english.png'),
    fullPage: true,
  });
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/home$/);
});

test('账户统计失败保持任务入口可用，重试前不显示虚假计数', async ({ page }) => {
  let fail = true;
  await page.route('**/api/console/v1/dashboard', (route) =>
    fail
      ? route.fulfill({ status: 503, json: { error: { code: 'unavailable' } } })
      : route.continue(),
  );
  await login(page);
  const main = page.getByRole('main');
  await expect(main.locator('a[href="/users"]')).toBeVisible();
  await expect(main.getByRole('button', { name: '重试', exact: true })).toBeVisible();
  await expect(main.locator('dd')).toHaveCount(0);
  fail = false;
  await main.getByRole('button', { name: '重试', exact: true }).click();
  await expect(main.locator('dd')).toHaveCount(2);
  await expect(main.getByRole('button', { name: '重试', exact: true })).toHaveCount(0);
});
