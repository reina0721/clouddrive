import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { saveEvidenceScreenshot } from './evidence-screenshot';

async function confirm(page: Page, title: string) {
  const dialog = page.getByRole('alertdialog', { name: title, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function logout(page: Page) {
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
}
async function login(page: Page, email: string, password: string) {
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
}

test('M2–M5 user, role grants, inbox and audit form a durable management workflow', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto('/users/create');
  await page.getByRole('textbox', { name: '姓名', exact: true }).fill('M25 Managed member');
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('m25-member@example.test');
  await page.getByLabel('初始密码', { exact: true }).fill('ManagedPassword2026!');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page).toHaveURL(/\/users\/detail\?id=/, { timeout: 15000 });
  const userId = new URL(page.url()).searchParams.get('id');
  if (!userId) throw new Error('Created user URL has no ID');
  await page.getByRole('link', { name: '编辑用户', exact: true }).click();
  await expect(page).toHaveURL(/\/users\/edit\?id=/);
  await page.reload();
  await page.getByRole('textbox', { name: '姓名', exact: true }).fill('M25 Updated member');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('用户已保存', { exact: true })).toBeVisible();
  await page.goto(`/users/detail?id=${encodeURIComponent(userId)}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('M25 Updated member');

  await page.goto('/roles/create');
  await page.getByRole('textbox', { name: '角色名称', exact: true }).fill('M25 Audit reviewer');
  for (const name of ['查询审计日志', '编辑自己的资料'])
    await page.getByRole('checkbox', { name, exact: true }).press('Space');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText('新增授权');
  await confirm(page, '确认角色授权');
  await expect(page).toHaveURL(/\/roles\/detail\?id=/, { timeout: 15000 });
  const roleId = new URL(page.url()).searchParams.get('id');
  if (!roleId) throw new Error('Created role URL has no ID');
  await page.goto(`/users/detail?id=${encodeURIComponent(userId)}`);
  await page.getByRole('checkbox', { name: '受限成员', exact: true }).press('Space');
  await page.getByRole('checkbox', { name: 'M25 Audit reviewer', exact: true }).press('Space');
  await page.getByRole('button', { name: '保存角色', exact: true }).click();
  await confirm(page, '确认角色分配');
  await page.reload();
  await expect(
    page.getByRole('checkbox', { name: 'M25 Audit reviewer', exact: true }),
  ).toBeChecked();
  await page.goto(`/roles/detail?id=${encodeURIComponent(roleId)}`);
  await expect(page.getByRole('link', { name: 'M25 Updated member', exact: true })).toBeVisible();
  await page.goto('/audit-logs?q=M25');
  await expect(page.getByRole('main')).toContainText('M25 Audit reviewer');
  await expect(page.getByRole('main')).toContainText('M25 Updated member');
  await page.getByRole('main').getByRole('link', { name: '修改用户角色', exact: true }).click();
  await expect(page).toHaveURL(/\/audit-logs\/detail\?.*\bid=/, { timeout: 15000 });
  await expect(page.getByRole('main')).toContainText('mock-demo');
  await expect(page.getByRole('main')).toContainText(userId);
  await expect(
    page.getByRole('main').getByRole('button', { name: '保存', exact: true }),
  ).toHaveCount(0);

  await page.goto('/notifications?read=unread');
  await expect(page.getByRole('main')).toContainText('M25 Updated member');
  await page.getByRole('button', { name: '全部标为已读', exact: true }).click();
  await expect(page.getByRole('main')).toContainText('0 条未读');
  await page.getByRole('button', { name: '通知', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '通知中心', exact: true });
  await expect(drawer).toContainText('M25 Updated member');
  await expect(drawer.getByRole('button', { name: '全部标为已读', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await logout(page);
  await login(page, 'm25-member@example.test', 'ManagedPassword2026!');
  await page.goto('/audit-logs');
  await expect(
    page.getByRole('heading', { name: '审计日志', exact: true, level: 1 }),
  ).toBeVisible();
  await page.goto('/users');
  await expect(page.getByRole('main')).toContainText('没有操作权限');
  await page.goto('/account');
  await page.getByRole('textbox', { name: '姓名', exact: true }).fill('M25 Personal profile');
  await page.getByRole('button', { name: '保存资料', exact: true }).click();
  await expect(page.getByText('个人资料已保存', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: '姓名', exact: true })).toHaveValue(
    'M25 Personal profile',
  );
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await expect(page.getByRole('menu')).toContainText('M25 Personal profile');
  await page.keyboard.press('Escape');
  await saveEvidenceScreenshot(page, {
    path: testInfo.outputPath('m25-account.png'),
    fullPage: true,
  });
});

test('Restricted account has its own inbox/profile and no management navigation or write access', async ({
  page,
}) => {
  await page.goto('/');
  await logout(page);
  await login(page, 'viewer@community.test', 'CommunityDemo2026!');
  const nav = page.getByRole('navigation', { name: '主导航', exact: true });
  for (const name of ['用户管理', '角色管理', '审计日志'])
    await expect(nav.getByRole('link', { name, exact: true })).toHaveCount(0);
  for (const path of ['/users/create', '/roles/create', '/roles/permissions', '/audit-logs']) {
    await page.goto(path);
    await expect(page.getByRole('main')).toContainText('没有操作权限');
    await expect(
      page.getByRole('main').getByRole('button', { name: '保存', exact: true }),
    ).toHaveCount(0);
  }
  await page.goto('/notifications');
  await expect(page.getByRole('main')).toContainText('暂无通知');
  await page.goto('/account');
  await expect(page.getByRole('textbox', { name: '姓名', exact: true })).toHaveValue('Morgan Lee');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});

test('M2–M5 pages retain accessible responsive layout in Chinese light and English dark', async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  const routes = [
    '/users',
    '/users/create',
    '/users/detail?id=member-001',
    '/users/edit?id=member-001',
    '/account',
    '/roles',
    '/roles/create',
    '/roles/detail?id=operator',
    '/roles/permissions',
    '/notifications',
    '/audit-logs',
  ];
  for (const english of [false, true]) {
    if (english) {
      await page.goto('/settings/locale');
      await page.getByRole('radio', { name: 'English', exact: true }).press('Space');
      await page.goto('/settings');
      await page.getByRole('radio', { name: 'Dark theme', exact: true }).press('Space');
    }
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const path of routes) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(
          page
            .getByRole('main')
            .getByRole('status', { name: english ? 'Loading data' : '正在读取数据', exact: true }),
        ).toHaveCount(0);
        await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
        await expect(page.getByRole('main')).not.toContainText(
          /identityProduct\.|management\.|roles\.(?:nav|description|impact)|users\.(?:title|description)|audit\.(?:nav|description)/,
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        const violations = (
          await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
        ).violations;
        expect(violations, path).toEqual([]);
        await saveEvidenceScreenshot(page, {
          path: testInfo.outputPath(
            `${english ? 'en-dark' : 'zh-light'}-${width}-${path.replace(/\?.*$/, '').replaceAll('/', '-')}.png`,
          ),
          fullPage: true,
        });
      }
    }
  }
});
