import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readPreviewAccess } from './reading-fixture';
import { storageSection as section } from './storage-fixture';

test.use({ actionTimeout: 15_000 });
test.beforeEach(() =>
  test.skip(!process.env.CLOUDDRIVE_FILE_TEST_ACCESS, '仅使用显式指定的隔离预览。'),
);
async function login(page: Page, credentials = readPreviewAccess()) {
  await page.goto('/login?returnTo=%2Fsystem-tools%2Fruntime');
  await page.getByLabel('邮箱', { exact: true }).fill(credentials.username);
  await page.getByLabel('密码', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '服务运行状态', exact: true })).toBeVisible();
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

test('真实运行数据按任务阅读，原始指标与安全事件仅主动读取', async ({ page }, info) => {
  const requests: string[] = [];
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  await expect(section(page, '接收请求')).toContainText('可以接收请求');
  await expect(section(page, '进程存活')).toContainText('进程存活');
  await expect(section(page, '依赖与进程').getByRole('definition').first()).toContainText('已就绪');
  await expect(section(page, '运行指标')).toContainText('累计请求');
  await expect(section(page, '构建与部署信息')).toContainText('Go 版本');
  expect(requests.filter((path) => path === '/management/metrics')).toEqual([]);
  expect(requests.filter((path) => path.endsWith('/auth/audit'))).toEqual([]);
  await expect(page.getByRole('main')).not.toContainText('[object Object]');
  await accessible(page);
  await page.screenshot({ path: info.outputPath('runtime-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: '进程详情与运行单元', exact: true }).click();
  await expect(page.getByRole('grid', { name: '运行单元' })).toContainText('参与组件');
  await page.getByRole('button', { name: '读取原始指标', exact: true }).click();
  await expect(section(page, '运行指标').locator('pre')).toContainText('# HELP');
  expect(requests.filter((path) => path === '/management/metrics')).toHaveLength(1);
  await page.getByRole('button', { name: '收起原始指标', exact: true }).click();
  await expect(section(page, '运行指标').locator('pre')).toHaveCount(0);
  await page.getByRole('button', { name: '读取安全事件', exact: true }).click();
  await expect(page.getByRole('grid', { name: '安全事件' })).toBeVisible();
  await expect.poll(() => requests.filter((path) => path.endsWith('/auth/audit')).length).toBe(1);
  await expect(page.getByRole('grid', { name: '安全事件' })).toContainText('成功');
  expect(failures).toEqual([]);
});

test('故障注入：503 未就绪与指标读取失败各自呈现，重试不重读正常区段', async ({ page }, info) => {
  let metrics = 0;
  let probes = 0;
  await page.route('**/management/readyz', async (route) => {
    probes++;
    await route.fulfill({ status: 503, json: { status: 'fail' } });
  });
  await page.route('**/management/metrics-summary', async (route) => {
    metrics++;
    if (metrics === 1) return route.fulfill({ status: 403, json: {} });
    await route.continue();
  });
  await page.route('**/management/diagnostics', async (route) => {
    const response = await route.fetch();
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object') throw new Error('Invalid runtime diagnostic fixture');
    await route.fulfill({
      response,
      json: {
        ...value,
        cleanupRequired: true,
        lastFailureOwner: 'fixture-worker',
        lastFailurePhase: 'run',
        lastFailureType: 'fixture-timeout',
      },
    });
  });
  await login(page);
  await expect(section(page, '接收请求')).toContainText('尚未就绪');
  await expect(section(page, '接收请求')).not.toContainText('未能读取');
  await expect(section(page, '进程存活')).toContainText('进程存活');
  await expect(section(page, '依赖与进程')).toContainText('fixture-worker');
  await expect(section(page, '依赖与进程')).toContainText('fixture-timeout');
  await expect(section(page, '依赖与进程')).toContainText('有待清理的运行资源');
  await expect(section(page, '运行指标')).toContainText('当前账户没有读取此项信息的权限');
  await section(page, '运行指标').getByRole('button', { name: '重试', exact: true }).click();
  await expect(section(page, '运行指标')).toContainText('累计请求');
  expect(metrics).toBe(2);
  expect(probes).toBe(1);
  await accessible(page);
  await page.screenshot({ path: info.outputPath('runtime-partial-failure.png'), fullPage: true });
});

test('故障注入：安全事件权限变化单独报错，重试与翻页保持独立', async ({ page }) => {
  let probes = 0;
  const cursors: string[] = [];
  await page.route('**/management/readyz', async (route) => {
    probes++;
    await route.continue();
  });
  await page.route('**/api/console/v1/native/auth/audit?*', async (route) => {
    cursors.push(new URL(route.request().url()).searchParams.get('cursor') ?? '');
    if (cursors.length === 1) return route.fulfill({ status: 403, json: {} });
    await route.continue();
  });
  await login(page);
  await page.getByRole('button', { name: '读取安全事件', exact: true }).click();
  const events = section(page, '安全事件');
  await expect(events).toContainText('当前账户没有读取此项信息的权限');
  await expect(section(page, '接收请求')).toContainText('可以接收请求');
  await events.getByRole('button', { name: '重试', exact: true }).click();
  await expect(events.getByRole('grid', { name: '安全事件', exact: true })).toBeVisible();
  await events.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(events.getByRole('button', { name: '上一页', exact: true })).toBeEnabled();
  await expect.poll(() => cursors.length).toBe(3);
  expect(cursors[2]).toBeTruthy();
  await events.getByRole('button', { name: '上一页', exact: true }).click();
  await expect(events.getByRole('button', { name: '上一页', exact: true })).toBeDisabled();
  expect(cursors[3]).toBe('');
  expect(probes).toBe(1);
});

test('矛盾探针响应保留协议错误，不影响其他检查和真实构建信息', async ({ page }) => {
  await page.route('**/management/readyz', (route) =>
    route.fulfill({ status: 503, json: { status: 'pass' } }),
  );
  await login(page);
  await expect(section(page, '接收请求')).toContainText('服务返回的内容不符合预期');
  await expect(section(page, '接收请求')).not.toContainText('可以接收请求');
  await expect(section(page, '构建与部署信息')).toContainText('Go 版本');
  await expect(section(page, '依赖与进程')).toContainText('运行时长');
});

test('刷新取消旧探针，迟到的失败不能覆盖新结果', async ({ page }) => {
  let reads = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let completed!: () => void;
  const oldCompleted = new Promise<void>((resolve) => {
    completed = resolve;
  });
  await page.route('**/management/readyz', async (route) => {
    reads++;
    if (reads === 1) {
      await gate;
      try {
        await route.fulfill({ status: 503, json: { status: 'fail' } });
      } finally {
        completed();
      }
    } else await route.fulfill({ json: { status: 'pass' } });
  });
  try {
    await login(page);
    await expect.poll(() => reads).toBe(1);
    await page.getByRole('main').getByRole('button', { name: '刷新', exact: true }).click();
    await expect(section(page, '接收请求')).toContainText('可以接收请求');
    release();
    await oldCompleted;
    await expect.poll(() => reads).toBe(2);
    await expect(section(page, '接收请求')).not.toContainText('尚未就绪');
  } finally {
    release();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

test('真实仅运行读取角色不请求安全审计，也不能调用受保护审计端点', async ({ page, browser }) => {
  await login(page);
  const credentials = {
    ...readPreviewAccess(),
    username: 'runtime-' + randomUUID().slice(0, 8) + '@clouddrive.test',
    password: randomUUID(),
  };
  await page.evaluate(async (credentials) => {
    const csrf = await fetch('/api/console/v1/auth/csrf');
    const { token } = (await csrf.json()) as { token: string };
    async function write(path: string, body: unknown, method = 'POST') {
      const response = await fetch('/api/console/v1' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Runtime fixture HTTP ' + response.status);
      return (await response.json()) as Record<string, unknown>;
    }
    const role = (await write('/roles', { name: credentials.username, permissions: [] })).role as {
      id: string;
    };
    await write(
      '/native/iam/roles/' + role.id + '/permissions',
      { expectedRoleVersion: 1, permissionKeys: ['management:read'] },
      'PUT',
    );
    await write('/users', {
      email: credentials.username,
      password: credentials.password,
      name: '运行状态验收',
      roleIds: [role.id],
      status: 'active',
    });
  }, credentials);
  const context = await browser.newContext({
    baseURL: readPreviewAccess().origin,
    locale: 'zh-CN',
  });
  try {
    const visitor = await context.newPage();
    const auditRequests: string[] = [];
    visitor.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/auth/audit'))
        auditRequests.push(request.url());
    });
    await login(visitor, credentials);
    await expect(section(visitor, '接收请求')).toContainText('可以接收请求');
    await expect(section(visitor, '运行指标')).toContainText('累计请求');
    await expect(visitor.getByRole('button', { name: '读取安全事件', exact: true })).toHaveCount(0);
    expect(auditRequests).toEqual([]);
    expect(
      await visitor.evaluate(
        async () => (await fetch('/api/console/v1/native/auth/audit?limit=1')).status,
      ),
    ).toBe(403);
  } finally {
    await context.close();
  }
});

test('320px 英文深色运行页和按需语言示例保持可读与可访问', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await login(page);
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Service status', exact: true })).toBeVisible();
  await expect(section(page, 'Runtime metrics')).toContainText('Total requests');
  await accessible(page);
  await page.screenshot({ path: info.outputPath('runtime-mobile-dark-en.png'), fullPage: true });
  await page.goto('/foundations');
  await expect(
    page.getByRole('heading', { name: 'Page messages, loaded on demand', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Current user', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Language English', exact: true }).click();
  await page.getByRole('menuitemradio', { name: '简体中文', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '页面文案，按需安装', exact: true }),
  ).toBeVisible();
});
