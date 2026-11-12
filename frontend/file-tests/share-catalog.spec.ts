import { randomUUID } from 'node:crypto';
import { expect, test, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readPreviewAccess } from './reading-fixture';
import { shareMenuAction } from './share-actions';

test.use({ actionTimeout: 15_000 });
type Share = { id: string; token: string; revision: number; title: string; status: string };
async function login(page: Page) {
  const access = readPreviewAccess();
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}
async function api<T>(page: Page, path: string, method = 'GET', body?: unknown): Promise<T> {
  const result = await page.evaluate(
    async ({ path, method, body }) => {
      const { token } = (await (await fetch('/api/console/v1/auth/csrf')).json()) as {
        token: string;
      };
      const response = await fetch('/api/console/v1/native/files' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, value: (await response.json()) as unknown };
    },
    { path, method, body },
  );
  expect(result.status, method + ' ' + path).toBe(200);
  return result.value as T;
}
async function fixture(
  page: Page,
  options: { count?: number; states?: boolean; expired?: boolean; longTitle?: boolean } = {},
) {
  await login(page);
  const prefix = '项目交接-' + randomUUID().slice(0, 8);
  const file = await api<{ id: string }>(page, '/text', 'POST', {
    parentId: '',
    name: prefix + '.txt',
    text: '项目交接资料',
    key: randomUUID(),
  });
  const shares: Share[] = [];
  for (let index = 0; index < (options.count ?? 3); index++) {
    const names = options.states ? ['可访问', '已暂停', '已结束'] : [];
    let share = await api<Share>(page, '/shares', 'POST', {
      rootId: file.id,
      title:
        prefix +
        ' · ' +
        (options.longTitle
          ? 'handover-document-'.repeat(10)
          : (names[index] ?? String(index + 1).padStart(2, '0'))),
    });
    if (options.states && index === 1)
      share = await api<Share>(page, '/shares/' + share.id + '/state', 'PUT', {
        revision: share.revision,
        enabled: false,
      });
    if (options.states && index === 2)
      share = await api<Share>(page, '/shares/' + share.id + '/revoke', 'POST');
    shares.push(share);
  }
  if (options.expired) {
    const share = await api<Share>(page, '/shares', 'POST', {
      rootId: file.id,
      title: prefix + ' · 已到期',
      expiresAt: new Date(Date.now() + 5000).toISOString(),
    });
    shares.push(share);
    await expect
      .poll(
        async () =>
          (await api<{ items: Share[] }>(page, '/shares?search=' + prefix)).items.find(
            (item) => item.id === share.id,
          )?.status,
      )
      .toBe('expired');
  }
  return { prefix, file, shares, url: '/home/shares?search=' + encodeURIComponent(prefix) };
}
const row = (page: Page, id: string) => page.locator(`[data-share-id="${id}"]`);
async function search(page: Page, value: string) {
  const form = page.getByRole('search', { name: '搜索分享', exact: true });
  await form.getByRole('searchbox').fill(value);
  await form.getByRole('button', { name: '搜索', exact: true }).click();
}
async function select(page: Page, label: RegExp, value: string) {
  await page.getByRole('button', { name: label }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
}
async function axe(page: Page) {
  // 审核实际可读状态；不能等待整页可能处于挂起状态的滚动过渡。
  await expect
    .poll(
      async () =>
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
      { message: '界面稳定后应满足对比度与无障碍要求' },
    )
    .toEqual([]);
}
async function details(page: Page, item: Locator) {
  await item.getByRole('button', { name: /^查看 .* 的分享详情$/ }).click();
  return page.getByRole('dialog');
}

test('分享列表按状态组织动作，复制失败保留记录，暂停与撤销使用明确确认', async ({
  page,
  context,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const f = await fixture(page, { states: true, expired: true });
  await page.goto(f.url);
  const [active, paused, revoked, expired] = f.shares.map((share) => row(page, share.id)) as [
    Locator,
    Locator,
    Locator,
    Locator,
  ];
  await expect(page.locator('[data-share-id]')).toHaveCount(4);
  await page.getByRole('heading', { name: '我的分享', exact: true }).click();
  await page.keyboard.press('/');
  await expect(page.getByRole('searchbox')).toBeFocused();
  await expect(page.locator('[data-file-workspace-search]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '新建', exact: true })).toBeVisible();
  await expect(active.getByRole('button', { name: '复制链接', exact: true })).toBeVisible();
  await expect(paused.getByRole('button', { name: '恢复分享', exact: true })).toBeVisible();
  await expect(paused.getByRole('link')).toHaveCount(0);
  await expect(expired.getByRole('button', { name: '修改分享设置', exact: true })).toBeVisible();
  await expect(revoked.getByRole('button', { name: /分享操作$/ })).toHaveCount(0);
  await expect(revoked.getByRole('link')).toHaveCount(0);
  const preview = active.getByRole('link', { name: '以访客身份预览', exact: true });
  await expect(preview).toHaveAttribute(
    'href',
    new URL('/share#token=' + f.shares[0].token, page.url()).href,
  );
  await axe(page);
  await page.screenshot({ path: info.outputPath('share-catalog-desktop.png') });

  await page.evaluate(() =>
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new DOMException('Clipboard denied', 'NotAllowedError')),
    }),
  );
  await active.getByRole('button', { name: '复制链接', exact: true }).click();
  await expect(active.getByRole('alert')).toContainText('打开分享详情');
  await expect(page.locator('[data-share-id]')).toHaveCount(4);
  await expect(paused).toBeVisible();
  const visitorHref = await preview.getAttribute('href');
  const drawer = await details(page, active);
  await expect(drawer.getByRole('link', { name: '以访客身份预览', exact: true })).toHaveAttribute(
    'href',
    visitorHref,
  );
  await drawer.getByRole('button', { name: '关闭', exact: true }).click();
  await page.evaluate(() => Reflect.deleteProperty(navigator.clipboard, 'writeText'));
  await active.getByRole('button', { name: '复制链接', exact: true }).click();
  await expect(active.getByRole('status')).toHaveText('链接已复制');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    await preview.getAttribute('href'),
  );

  await shareMenuAction(page, active, '暂停分享');
  let confirm = page.getByRole('alertdialog', { name: '暂停分享', exact: true });
  await confirm.press('/');
  expect(await confirm.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await confirm.getByRole('button', { name: '取消', exact: true }).click();
  await expect(active.getByRole('button', { name: /分享操作$/ })).toBeFocused();
  await shareMenuAction(page, active, '暂停分享');
  confirm = page.getByRole('alertdialog', { name: '暂停分享', exact: true });
  await confirm.getByRole('button', { name: '确定', exact: true }).click();
  await expect(active.getByRole('button', { name: '恢复分享', exact: true })).toBeVisible();
  expect((await page.request.get('/api/v1/file-shares/' + f.shares[0].token)).status()).toBe(404);
  await active.getByRole('button', { name: '恢复分享', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: '恢复分享', exact: true })
    .getByRole('button', { name: '确定', exact: true })
    .click();
  await expect(active.getByRole('button', { name: '复制链接', exact: true })).toBeVisible();
  expect((await page.request.get('/api/v1/file-shares/' + f.shares[0].token)).status()).toBe(200);
  await shareMenuAction(page, active, '撤销分享');
  confirm = page.getByRole('alertdialog', { name: '撤销分享', exact: true });
  await expect(confirm).toContainText('不能恢复');
  await confirm.getByRole('button', { name: '撤销分享', exact: true }).click();
  await expect(active).toContainText('已撤销');
  await expect(active.getByRole('button', { name: '复制链接', exact: true })).toHaveCount(0);
  expect((await page.request.get('/api/v1/file-shares/' + f.shares[0].token)).status()).toBe(404);
  const original = await page.evaluate(async (id) => {
    const response = await fetch('/api/console/v1/native/files/' + id + '/content');
    return { status: response.status, text: await response.text() };
  }, f.file.id);
  expect(original.status).toBe(200);
  expect(original.text).toBe('项目交接资料');
});

test('检索分页保留在地址中，刷新与返回可恢复，空结果不冒充没有分享', async ({ page }) => {
  const f = await fixture(page, { count: 23 });
  await page.goto(f.url + '&sort=oldest&page=2');
  await expect(page.locator('[data-share-id]')).toHaveCount(3);
  await page.reload();
  await expect(page.locator('[data-share-id]')).toHaveCount(3);
  await expect(page.getByRole('searchbox')).toHaveValue(f.prefix);
  await page
    .getByRole('navigation', { name: '分享分页', exact: true })
    .getByRole('button', { name: '上一页', exact: true })
    .click();
  await expect(page.locator('[data-share-id]')).toHaveCount(20);
  expect(new URL(page.url()).searchParams.get('page')).toBeNull();
  await page.goBack();
  await expect(page.locator('[data-share-id]')).toHaveCount(3);
  expect(new URL(page.url()).searchParams.get('page')).toBe('2');
  await search(page, f.prefix + '-not-found');
  await expect(
    page.getByRole('heading', { name: '没有符合条件的分享', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: '没有分享记录', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: '分享分页', exact: true })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get('page')).toBeNull();
  await page.getByRole('button', { name: '清除筛选', exact: true }).click();
  await expect(page.locator('[data-share-id]')).toHaveCount(20);
  expect(new URL(page.url()).searchParams.get('search')).toBeNull();
  expect(new URL(page.url()).searchParams.get('sort')).toBe('oldest');
  await page.goto(f.url + '&state=active&sort=name&page=999');
  await expect(page.getByRole('heading', { name: '这一页没有分享', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回第一页', exact: true }).click();
  await expect(page.locator('[data-share-id]')).toHaveCount(20);
  expect(new URL(page.url()).searchParams.get('state')).toBe('active');
  expect(new URL(page.url()).searchParams.get('sort')).toBe('name');
  expect(new URL(page.url()).searchParams.get('search')).toBe(f.prefix);
});

test('读取失败可恢复，旧的设置响应不能打断新检索，版本冲突保留当前记录', async ({ page }) => {
  const f = await fixture(page);
  await page.goto(f.url);
  await expect(page.locator('[data-share-id]')).toHaveCount(3);
  await page.route(
    (url) => url.pathname === '/api/console/v1/native/files/shares',
    (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
    { times: 1 },
  );
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  const error = page.getByRole('main').getByRole('alert');
  await expect(error.getByRole('button', { name: '刷新', exact: true })).toBeVisible();
  await expect(page.locator('[data-share-id]')).toHaveCount(0);
  await error.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(page.locator('[data-share-id]')).toHaveCount(3);

  let release!: () => void, done!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const finished = new Promise<void>((resolve) => {
    done = resolve;
  });
  const read = (url: URL) =>
    url.pathname === '/api/console/v1/native/files/shares/' + f.shares[0].id;
  await page.route(read, async (route) => {
    try {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response });
    } catch {
      /* 检索切换会主动取消这次读取。 */
    } finally {
      done();
    }
  });
  try {
    await shareMenuAction(page, row(page, f.shares[0].id), '修改分享设置');
    await expect(row(page, f.shares[0].id).getByRole('status')).toHaveText('正在读取分享设置…');
    await search(page, f.prefix + '-missing');
    await expect(
      page.getByRole('heading', { name: '没有符合条件的分享', exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
  await finished;
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.unroute(read);
  await page.goto(f.url);
  const active = row(page, f.shares[0].id);
  await expect(active).toBeVisible();
  await api(page, '/shares/' + f.shares[0].id + '/state', 'PUT', {
    revision: f.shares[0].revision,
    enabled: false,
  });
  await shareMenuAction(page, active, '暂停分享');
  const confirmation = page.getByRole('alertdialog', { name: '暂停分享', exact: true });
  await confirmation.getByRole('button', { name: '确定', exact: true }).click();
  await expect(confirmation.getByRole('alert')).toContainText('状态已变化');
  await expect(page.locator('[data-share-id]')).toHaveCount(3);
  await confirmation.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(active.getByRole('button', { name: '恢复分享', exact: true })).toBeVisible();
});

test('窄屏英文深色保留筛选和菜单，公共工具栏选择不横向溢出', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const f = await fixture(page, { count: 1, longTitle: true });
  await page.goto(f.url);
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  const originalTheme = await page.getByRole('menuitemradio', { checked: true }).innerText();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  let english = false;
  try {
    await page.getByRole('button', { name: '当前用户', exact: true }).click();
    await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
    english = true;
    await page.setViewportSize({ width: 320, height: 800 });
    await select(page, /Link status/, 'Enabled and not expired');
    const filterBounds = await page
      .getByRole('button', { name: /Link status/ })
      .evaluate((button) => {
        const toolbar = button.closest('[role="toolbar"]');
        if (!toolbar) throw new Error('Missing share filter toolbar');
        const container = toolbar.getBoundingClientRect();
        const style = getComputedStyle(toolbar);
        const control = button.getBoundingClientRect();
        return {
          left: control.left,
          right: control.right,
          start: container.left + Number.parseFloat(style.paddingLeft),
          end: container.right - Number.parseFloat(style.paddingRight),
        };
      });
    expect(filterBounds.left).toBeGreaterThanOrEqual(filterBounds.start - 1);
    expect(filterBounds.right).toBeLessThanOrEqual(filterBounds.end + 1);
    await expect(row(page, f.shares[0].id)).toBeVisible();
    await expect(page.getByText('1 share', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await page
        .locator('[data-file-scroll-region]')
        .evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
    await axe(page);
    await page.screenshot({ path: info.outputPath('share-catalog-mobile-dark.png') });
    await row(page, f.shares[0].id)
      .getByRole('button', { name: /^Share actions for / })
      .click();
    await expect(page.getByRole('menuitem', { name: 'Revoke share', exact: true })).toBeVisible();
    await axe(page);
    await page.screenshot({ path: info.outputPath('share-catalog-mobile-menu.png') });
    await page.keyboard.press('Escape');
    await page.goto('/ui-elements/forms');
    const toolbar = page.getByRole('button', { name: /Toolbar selection/ });
    await expect(toolbar).toBeVisible();
    expect((await toolbar.boundingBox())!.width).toBeLessThanOrEqual(240);
    await toolbar.click();
    await expect(
      page.getByRole('option', { name: 'Enabled share links that have not expired', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
  } finally {
    if (!page.isClosed()) {
      await page.keyboard.press('Escape');
      await page.goto(f.url);
      await page
        .getByRole('button', { name: english ? 'Current user' : '当前用户', exact: true })
        .click();
      if (english) {
        await page.getByRole('menuitem', { name: 'Language English', exact: true }).click();
        await page.getByRole('menuitemradio', { name: '简体中文', exact: true }).click();
        await page.getByRole('button', { name: '当前用户', exact: true }).click();
      }
      await page.getByRole('menuitem', { name: /^主题 / }).click();
      await page.getByRole('menuitemradio', { name: originalTheme, exact: true }).click();
    }
  }
});

test('没有分享的新账户得到文件入口，不显示没有作用的分页', async ({ page, browser }, info) => {
  await login(page);
  const suffix = randomUUID().slice(0, 8);
  const account = { username: 'catalog-' + suffix + '@clouddrive.test', password: randomUUID() };
  await page.evaluate(
    async ({ suffix, account }) => {
      const { token } = (await (await fetch('/api/console/v1/auth/csrf')).json()) as {
        token: string;
      };
      const write = async (path: string, method: string, body: unknown) => {
        const response = await fetch('/api/console/v1' + path, {
          method,
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error('Empty share fixture HTTP ' + response.status);
        return (await response.json()) as { role?: { id: string } };
      };
      const { role } = await write('/roles', 'POST', {
        name: '分享管理验收-' + suffix,
        permissions: ['account.update'],
      });
      await write('/native/iam/roles/' + role!.id + '/permissions', 'PUT', {
        expectedRoleVersion: 1,
        permissionKeys: ['files:read', 'files:write'],
      });
      await write('/users', 'POST', {
        email: account.username,
        password: account.password,
        name: '新用户',
        roleIds: [role!.id],
        status: 'active',
      });
    },
    { suffix, account },
  );
  const context = await browser.newContext({
    locale: 'zh-CN',
    viewport: { width: 390, height: 844 },
  });
  try {
    const member = await context.newPage();
    await member.goto(readPreviewAccess().origin + '/login?returnTo=%2Fhome%2Fshares');
    await member.getByLabel('邮箱', { exact: true }).fill(account.username);
    await member.getByLabel('密码', { exact: true }).fill(account.password);
    await member.getByRole('button', { name: '登录', exact: true }).click();
    await expect(member).toHaveURL(/\/home\/shares$/);
    await expect(member.getByRole('heading', { name: '没有分享记录', exact: true })).toBeVisible();
    await expect(member.getByRole('navigation', { name: '分享分页', exact: true })).toHaveCount(0);
    await expect(
      member.getByText('从我的文件中选择文件或文件夹，创建适合对方的分享链接。', { exact: true }),
    ).toBeVisible();
    await axe(member);
    await member.screenshot({ path: info.outputPath('share-empty-mobile.png') });
    await member.getByRole('button', { name: '选择文件分享', exact: true }).click();
    await expect(member).toHaveURL(/\/home$/);
    await expect(member.locator('[data-file-workspace-search]')).toBeVisible();
    await expect(member.getByRole('button', { name: '新建', exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});
