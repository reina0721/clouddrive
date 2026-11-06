import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

test.use({ actionTimeout: 15_000 });

const editor = {
  browse: true,
  preview: true,
  download: true,
  create: true,
  upload: true,
  modify: true,
  rename: true,
  move: true,
  copy: true,
  delete: true,
};
const reader = {
  ...editor,
  create: false,
  upload: false,
  modify: false,
  rename: false,
  move: false,
  copy: false,
  delete: false,
};
const denied = Object.fromEntries(Object.keys(editor).map((key) => [key, false]));
const audience = () => ({ anonymous: null, authenticated: null, accounts: [], roles: [] });

async function login(page: Page, credentials?: { username: string; password: string }) {
  const access =
    credentials ??
    (JSON.parse(
      (
        await readFile(
          resolve(
            __dirname,
            process.env.CLOUDDRIVE_FILE_TEST_ACCESS ?? '../../.data/preview-access.json',
          ),
          'utf8',
        )
      ).replace(/^\uFEFF/, ''),
    ) as { username: string; password: string });
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}

async function request(
  page: Page,
  path: string,
  method = 'GET',
  body?: unknown,
  status = 200,
): Promise<Record<string, unknown>> {
  const result = await page.evaluate(
    async ({ path, method, body }) => {
      const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
      const response = await fetch('/api/console/v1' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, value: (await response.json()) as Record<string, unknown> };
    },
    { path, method, body },
  );
  expect(result.status, '本地受控请求状态').toBe(status);
  return result.value;
}
const files = (page: Page, path: string, method = 'GET', body?: unknown, status = 200) =>
  request(page, '/native/files' + path, method, body, status);

async function fixture(page: Page, displayName?: string) {
  await login(page);
  const suffix = randomUUID().slice(0, 8);
  const createdRole = (
    await request(page, '/roles', 'POST', {
      name: '受众角色' + suffix,
      permissions: ['account.update'],
    })
  ).role as { id: string };
  const role = (await request(page, '/native/iam/roles/' + createdRole.id)).role as {
    id: string;
    code: string;
  };
  await request(page, '/native/iam/roles/' + role.id + '/permissions', 'PUT', {
    expectedRoleVersion: 1,
    permissionKeys: ['files:read', 'files:write'],
  });
  const credentials = {
    username: 'audience-' + suffix + '@clouddrive.test',
    password: randomUUID(),
  };
  const user = (
    await request(page, '/users', 'POST', {
      email: credentials.username,
      password: credentials.password,
      name: displayName ?? '受众成员' + suffix,
      roleIds: [role.id],
      status: 'active',
    })
  ).user as { id: string };
  const root = await files(page, '/folders', 'POST', { parentId: '', name: '受众-' + suffix });
  const folder = await files(page, '/folders', 'POST', { parentId: root.id, name: '独立目录' });
  const leaf = await files(page, '/text', 'POST', {
    parentId: folder.id,
    name: 'secret.txt',
    text: '受保护内容',
    key: randomUUID(),
  });
  const visible = await files(page, '/text', 'POST', {
    parentId: root.id,
    name: 'visible.txt',
    text: '可见内容',
    key: randomUUID(),
  });
  return { suffix, credentials, role, user, root, folder, leaf, visible };
}

async function select(page: Page, scope: Locator, label: string, option: string) {
  await scope.getByRole('button', { name: new RegExp(label + '$') }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function openPolicy(page: Page, name: string) {
  await page.getByRole('button', { name: name + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '权限设置', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '权限设置', exact: true });
  await expect(dialog.getByRole('button', { name: '保存权限', exact: true })).toBeEnabled();
  return dialog;
}
async function addTarget(page: Page, dialog: Locator, kind: '账号' | '角色', key: string) {
  if (kind === '角色') await select(page, dialog, '主体类型', '角色');
  await dialog.getByLabel(kind === '账号' ? '完整账号标识' : '角色编码', { exact: true }).fill(key);
  await dialog.getByRole('button', { name: '查找', exact: true }).click();
  await expect(dialog.getByText(/^找到：/)).toBeVisible();
  await dialog.getByRole('button', { name: '使用此主体', exact: true }).click();
}
async function save(dialog: Locator, label: string) {
  await dialog.getByRole('button', { name: label, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test('F281–289：UI创建禁止匿名、精确账号能力和真实登录返回', async ({ page, browser }, info) => {
  const f = await fixture(page);
  // 根目录有分页，通过真实搜索定位本次目录，避免依赖第一页的排序位置。
  await page.getByRole('searchbox', { name: '搜索文件', exact: true }).fill(String(f.root.name));
  await page.getByRole('button', { name: '搜索文件', exact: true }).click();
  await page.getByRole('button', { name: String(f.root.name) + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '分享', exact: true }).click();
  const create = page.getByRole('dialog', { name: '分享', exact: true });
  await create.getByLabel('分享标题（可选）', { exact: true }).fill('账号受众-' + f.suffix);
  await select(page, create, '匿名访客', '拒绝访问');
  await select(page, create, '已登录用户', '拒绝访问');
  await addTarget(page, create, '账号', f.credentials.username);
  await create
    .getByRole('region', { name: '账号规则', exact: true })
    .locator('legend')
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('audience-editor-desktop.png') });
  await create.getByRole('button', { name: '创建分享链接', exact: true }).click();
  const href = await create.getByRole('link').getAttribute('href');
  expect(href).toContain('#token=');
  await page.screenshot({ path: info.outputPath('audience-create.png') });
  const context = await browser.newContext({ locale: 'zh-CN' });
  try {
    const visitor = await context.newPage();
    await visitor.goto(new URL(href!, page.url()).href);
    await expect(
      visitor.getByText('当前访问者没有此分享的访问权限', { exact: true }),
    ).toBeVisible();
    await expect(visitor.getByText('visible.txt', { exact: true })).toHaveCount(0);
    await visitor.getByRole('link', { name: '登录后重试', exact: true }).click();
    expect(new URL(visitor.url()).search).not.toContain('token');
    await visitor.getByLabel('邮箱', { exact: true }).fill(f.credentials.username);
    await visitor.getByLabel('密码', { exact: true }).fill(f.credentials.password);
    await visitor.getByRole('button', { name: '登录', exact: true }).click();
    await expect(visitor).toHaveURL(/\/share#token=/);
    await expect(visitor.getByText('visible.txt', { exact: true })).toBeVisible();
    await expect(visitor.getByRole('button', { name: '上传文件', exact: true })).toHaveCount(0);
    await expect(
      visitor
        .locator('[data-shared-entry-id="' + String(f.visible.id) + '"]')
        .getByRole('button', { name: /重命名/ }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('F285–290：角色精确规则、账号拒绝优先与设置冲突保留草稿', async ({ page, browser }) => {
  const f = await fixture(page);
  const share = await files(page, '/shares', 'POST', {
    rootId: f.root.id,
    title: '角色受众-' + f.suffix,
    permissions: reader,
    audience: { ...audience(), anonymous: denied, authenticated: denied },
  });
  await page.goto('/home/shares');
  const row = page.locator('[data-share-id="' + String(share.id) + '"]');
  await row.getByRole('button', { name: '修改分享设置', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '修改分享设置', exact: true });
  await addTarget(page, dialog, '角色', f.role.code);
  await files(page, '/shares/' + String(share.id), 'PUT', {
    revision: share.revision,
    title: '服务器版本',
    permissions: reader,
    audience: { ...audience(), anonymous: denied, authenticated: denied },
    expiresAt: share.expiresAt,
    passwordAction: 'keep',
    password: '',
  });
  await dialog.getByRole('button', { name: '保存设置', exact: true }).click();
  await expect(dialog.getByRole('alert').first()).toContainText('状态已变化');
  await expect(dialog.getByRole('region', { name: '角色规则', exact: true })).toContainText(
    '受众角色',
  );
  await dialog.getByRole('button', { name: /读取最新/ }).click();
  await save(dialog, '保存设置');
  const context = await browser.newContext({ locale: 'zh-CN' });
  try {
    const member = await context.newPage();
    await member.goto(new URL('/home', page.url()).href);
    await login(member, f.credentials);
    await member.goto(new URL('/share#token=' + String(share.token), page.url()).href);
    await expect(member.getByText('visible.txt', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: '修改分享设置', exact: true }).click();
    dialog = page.getByRole('dialog', { name: '修改分享设置', exact: true });
    await addTarget(page, dialog, '账号', f.credentials.username);
    const rules = dialog.getByRole('region', { name: '账号规则', exact: true });
    await rules.getByRole('button').first().click();
    await page.getByRole('option', { name: '拒绝访问', exact: true }).click();
    await save(dialog, '保存设置');
    await member.reload();
    await expect(member.getByText('当前访问者没有此分享的访问权限', { exact: true })).toBeVisible();
    await row.getByRole('button', { name: '修改分享设置', exact: true }).click();
    dialog = page.getByRole('dialog', { name: '修改分享设置', exact: true });
    await dialog
      .getByRole('region', { name: '账号规则', exact: true })
      .getByRole('button', { name: '移除规则', exact: true })
      .click();
    await save(dialog, '保存设置');
    await member.reload();
    await expect(member.getByText('visible.txt', { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('F291–298：目录独立权限、继承来源、实际预览、恢复与复制移动', async ({
  page,
  browser,
}, info) => {
  const f = await fixture(page);
  const share = await files(page, '/shares', 'POST', { rootId: f.root.id, permissions: reader });
  await page.goto('/home?parent=' + String(f.root.id));
  const dialog = await openPolicy(page, String(f.folder.name));
  await select(page, dialog, '权限来源', '独立设置');
  await select(page, dialog, '本项默认能力', '拒绝访问');
  await save(dialog, '保存权限');
  await page.getByRole('button', { name: String(f.folder.name), exact: true }).click();
  let child = await openPolicy(page, String(f.leaf.name));
  await expect(child).toContainText('最近的独立祖先：独立目录');
  await child.getByRole('button', { name: '查看已保存的最终权限', exact: true }).click();
  await expect(child.getByText('无可用能力', { exact: true })).toBeVisible();
  await expect(child).toContainText('来源：独立目录');
  await page.screenshot({ path: info.outputPath('permission-inheritance.png') });
  await select(page, child, '权限来源', '独立设置');
  const fileRights = child.getByRole('group', { name: '本项默认能力', exact: true });
  await expect(fileRights.getByRole('checkbox', { name: '重命名子项', exact: true })).toBeVisible();
  await expect(fileRights.getByRole('checkbox', { name: '上传文件', exact: true })).toHaveCount(0);
  await expect(
    fileRights.getByRole('checkbox', { name: '新建目录和文字', exact: true }),
  ).toHaveCount(0);
  await child.getByRole('button', { name: '取消', exact: true }).click();
  const context = await browser.newContext({ locale: 'zh-CN' });
  try {
    const visitor = await context.newPage();
    await visitor.goto(new URL('/share#token=' + String(share.token), page.url()).href);
    await expect(visitor.getByText('visible.txt', { exact: true })).toBeVisible();
    await expect(visitor.getByText('独立目录', { exact: true })).toHaveCount(0);
    await page.goto('/home?parent=' + String(f.root.id));
    child = await openPolicy(page, String(f.folder.name));
    await select(page, child, '权限来源', '继承上级');
    await save(child, '保存权限');
    await visitor.reload();
    await expect(visitor.getByText('独立目录', { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
  const destination = await files(page, '/folders', 'POST', {
    parentId: f.root.id,
    name: '新祖先',
  });
  await files(page, '/' + String(destination.id) + '/access', 'PUT', {
    revision: 0,
    policy: { default: denied, audience: audience() },
  });
  await files(page, '/' + String(f.leaf.id) + '/access', 'PUT', {
    revision: 0,
    policy: { default: reader, audience: audience() },
  });
  const copied = await files(page, '/' + String(f.leaf.id) + '/copy', 'POST', {
    parentId: destination.id,
    name: '复制文件.txt',
  });
  const independent = await files(page, '/' + String(copied.id) + '/access');
  expect((independent.policy as { default: unknown }).default).toEqual(reader);
  expect(independent.revision).toBe(0);
  await files(page, '/' + String(copied.id) + '/access', 'PUT', { revision: 0, policy: null });
  const inherited = await files(page, '/' + String(copied.id) + '/access');
  expect(inherited.policy).toBeNull();
  expect((inherited.inheritedFrom as { id: string }).id).toBe(destination.id);
  await files(page, '/' + String(copied.id), 'PATCH', { parentId: f.root.id });
  const moved = await files(page, '/' + String(copied.id) + '/access');
  expect(moved.policy).toBeNull();
  expect(moved.inheritedFrom).toBeNull();
});

test('F297–300：子目录实际能力、移动窄屏和深色无障碍', async ({ page, browser }, info) => {
  const f = await fixture(page);
  const share = await files(page, '/shares', 'POST', { rootId: f.root.id, permissions: reader });
  await files(page, '/' + String(f.folder.id) + '/access', 'PUT', {
    revision: 0,
    policy: { default: editor, audience: audience() },
  });
  const context = await browser.newContext({
    locale: 'zh-CN',
    viewport: { width: 320, height: 800 },
    colorScheme: 'dark',
  });
  try {
    const visitor = await context.newPage();
    await visitor.goto(new URL('/share#token=' + String(share.token), page.url()).href);
    await visitor
      .locator('[data-shared-entry-id="' + String(f.folder.id) + '"]')
      .getByRole('button', { name: '打开目录', exact: true })
      .click();
    await expect(visitor.getByRole('button', { name: '上传文件', exact: true })).toBeVisible();
    await expect(visitor.getByRole('button', { name: '新建目录', exact: true })).toBeVisible();
    await expect
      .poll(() => visitor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    expect(
      (await new AxeBuilder({ page: visitor }).withTags(['wcag2a', 'wcag2aa']).analyze())
        .violations,
    ).toEqual([]);
    await visitor.getByRole('heading', { level: 1 }).click();
    await visitor.screenshot({ path: info.outputPath('audience-mobile-dark.png'), fullPage: true });
  } finally {
    await context.close();
  }
});

test('权限编辑器长主体名称、英文深色与320px无障碍', async ({ page }, info) => {
  const f = await fixture(page, 'AudienceMember'.repeat(8));
  await page.goto('/home');
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await page.goto('/home?parent=' + String(f.root.id));
  await page
    .getByRole('button', { name: 'Actions for ' + String(f.folder.name), exact: true })
    .click();
  await page.getByRole('menuitem', { name: 'Permissions', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Permissions', exact: true });
  await expect(dialog.getByRole('button', { name: 'Save permissions', exact: true })).toBeEnabled();
  await select(page, dialog, 'Permission source', 'Set independently');
  await dialog.getByLabel('Exact account identifier', { exact: true }).fill(f.credentials.username);
  await dialog.getByRole('button', { name: 'Find', exact: true }).click();
  await dialog.getByRole('button', { name: 'Use this subject', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 800 });
  const accountRules = dialog.getByRole('region', { name: 'Account rules', exact: true });
  await expect
    .poll(() => accountRules.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
  await expect
    .poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth))
    .toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await dialog.locator('legend').filter({ hasText: 'AudienceMember' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('audience-editor-mobile-dark-english.png') });
});
