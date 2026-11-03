import { z } from 'zod';
import { userSchema, auditRecordSchema } from '@clouddrive/surface/identity';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { saveEvidenceScreenshot } from './evidence-screenshot';

test('Home has only recents and never redirects to a saved draft', async ({ page }) => {
  await page.goto('/settings/actions');
  const autosave = page.getByRole('switch', { name: '本地草稿自动保存' });
  if (!(await autosave.isChecked())) await autosave.press('Space');
  await page.goto('/reference-resources/create');
  await page.getByLabel('名称', { exact: true }).fill('Retained draft');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible();
  await expect(page.locator('#workbench-recents')).toBeVisible();
  await expect(page.getByRole('main').getByRole('heading')).toHaveText(['工作台', '最近访问']);
  for (const id of [
    'workbench-drafts',
    'workbench-favorites',
    'workbench-activity',
    'workbench-shortcuts',
  ])
    await expect(page.locator('#' + id)).toHaveCount(0);
  await page.goto('/reference-resources/create');
  await expect(page.getByLabel('名称', { exact: true })).toHaveValue('Retained draft');
});

test('Bulk status preserves protected users and reports partial results', async ({ page }) => {
  await page.goto('/users?pageSize=50');
  await page.getByRole('checkbox', { name: '选择当前页', exact: true }).press('Space');
  await page.getByRole('button', { name: '批量停用', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('不能停用当前账号');
  await dialog.getByRole('button', { name: '确认修改', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('main')).toContainText('成功');
  const persisted: unknown = JSON.parse(
    await page.evaluate(() => localStorage.getItem('clouddrive.auth-mock') ?? ''),
  );
  const state = z
    .object({
      state: z
        .object({ users: z.array(userSchema), auditRecords: z.array(auditRecordSchema) })
        .passthrough(),
    })
    .passthrough()
    .parse(persisted).state;
  expect(state.users.find((user) => user.id === 'mock-demo')?.status).toBe('active');
  expect(
    state.auditRecords.some(
      (record: { result: string; operation: string }) =>
        record.result === 'failure' && record.operation === 'users.status',
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '用户管理', exact: true, level: 1 }),
  ).toBeVisible();
});

test('Role members change only the selected role and audit filters survive detail return', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/roles/create');
  await page.getByRole('textbox', { name: '角色名称', exact: true }).fill('Review role');
  await page.getByRole('checkbox', { name: '编辑自己的资料', exact: true }).press('Space');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '保存', exact: true }).click();
  await expect(page).toHaveURL(/\/roles\/detail\?id=/);
  const roleId = new URL(page.url()).searchParams.get('id');
  await page.getByRole('searchbox', { name: '搜索待添加用户' }).fill('Member 01');
  await page
    .getByRole('button', { name: /添加成员/ })
    .first()
    .click();
  await page.getByRole('option', { name: /Member 01/ }).click();
  await page.getByRole('button', { name: '添加成员', exact: true }).last().click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '确认变更', exact: true })
    .click();
  await expect(page.getByRole('link', { name: 'Member 01', exact: true })).toBeVisible();
  const persisted: unknown = JSON.parse(
    await page.evaluate(() => localStorage.getItem('clouddrive.auth-mock') ?? ''),
  );
  const users = z
    .object({ state: z.object({ users: z.array(userSchema) }).passthrough() })
    .passthrough()
    .parse(persisted).state.users;
  const roles = users.find((user) => user.id === 'member-001')?.roleIds;
  expect(roles).toEqual(['viewer', roleId]);
  await page.getByRole('button', { name: '移除成员', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '确认变更', exact: true })
    .click();
  await expect(page.getByRole('main')).toContainText('此角色尚未分配给任何用户。');
  await page.goto(
    '/audit-logs?actor=Rin&object=Member&operation=users.roles&result=success&page=1&pageSize=20',
  );
  await page.getByRole('link', { name: '修改用户角色', exact: true }).first().click();
  await page.getByRole('link', { name: '返回审计列表', exact: true }).click();
  await expect(page).toHaveURL(/actor=Rin/);
  await expect(page).toHaveURL(/object=Member/);
});

test('Account password changes reject bad credentials then revoke sessions and require sign-in', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/account');
  await expect(page.getByText('当前会话', { exact: true })).toBeVisible();
  await page.getByLabel('当前密码', { exact: true }).fill('IncorrectPassword!');
  await page.getByLabel('新密码', { exact: true }).fill('NewPassword2026!');
  await page.getByRole('button', { name: '修改密码', exact: true }).click();
  await expect(page.getByRole('main')).toContainText('请检查当前密码');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByLabel('当前密码', { exact: true })).toBeFocused();
  await page.getByLabel('当前密码', { exact: true }).fill('CommunityDemo2026!');
  await page.getByRole('button', { name: '修改密码', exact: true }).click();
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  await page.goto('/login');
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('demo@community.test');
  await page.getByLabel('密码', { exact: true }).fill('NewPassword2026!');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
  await page.goto('/account');
  await page.getByRole('button', { name: '退出当前会话', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
});

for (const variant of ['zh-light', 'en-dark'] as const)
  test(`Seven entrances remain usable across devices: ${variant}`, async ({ page }, testInfo) => {
    test.setTimeout(240000);
    await page.goto('/');
    if (variant === 'en-dark') {
      await page.getByRole('button', { name: '切换语言', exact: true }).click();
      await page.getByRole('button', { name: 'Switch theme', exact: true }).click();
    }
    for (const width of [320, 390, 768, 1440, 2560]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const path of [
        '/',
        '/users',
        '/roles',
        '/audit-logs',
        '/system-settings',
        '/account',
        '/notifications',
      ]) {
        await page.goto(path);
        await expect(page.locator('main h1')).toBeVisible();
        await expect(page.locator('main')).not.toContainText('identityProduct.');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        if (width === 320 || width === 1440) {
          const axe = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze();
          expect(axe.violations).toEqual([]);
          await saveEvidenceScreenshot(page, {
            path: testInfo.outputPath(`${path === '/' ? 'home' : path.slice(1)}-${width}.png`),
            fullPage: true,
          });
        }
      }
    }
  });

for (const width of [320, 390])
  test(`Mobile management filters and bulk confirmation remain accessible at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(
      '/audit-logs?from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-13T23%3A59%3A59.999Z',
    );
    await page.getByText('筛选条件', { exact: true }).click();
    const field = page
      .locator('.ui-field')
      .filter({ has: page.getByText('开始日期', { exact: true }) });
    const calendarTrigger = field.getByRole('button');
    await expect(field.getByRole('spinbutton', { name: /年|year/i })).toHaveAttribute(
      'aria-valuenow',
      '2026',
    );
    await calendarTrigger.click();
    await expect(page.getByRole('grid')).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(calendarTrigger).toBeFocused();
    await page.getByRole('button', { name: '清除筛选', exact: true }).click();
    await expect(page).toHaveURL(/\/audit-logs$/);
    // 高级筛选区由 CollectionQuery 折叠披露承载（不再是 <details>）。
    const filtersToggle = page.getByRole('button', { name: /筛选条件/ });
    await expect(filtersToggle).toHaveAttribute('aria-expanded', 'false');
    await filtersToggle.click();
    await expect(field.getByRole('spinbutton', { name: /年|year/i })).not.toHaveAttribute(
      'aria-valuenow',
    );
    await page.goto('/users?pageSize=50');
    await page.getByRole('checkbox', { name: '选择当前页', exact: true }).press('Space');
    await page.getByRole('button', { name: '批量停用', exact: true }).click();
    const confirmation = page.getByRole('alertdialog');
    await expect(confirmation).toBeVisible();
    // Overlay enter 动画结束再做 Axe 扫描：半透明过渡态会得到被混合后的低对比度读数。
    await expect(page.locator('[data-entering]')).toHaveCount(0);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await confirmation.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.getByRole('button', { name: '批量停用', exact: true })).toBeFocused();
  });
