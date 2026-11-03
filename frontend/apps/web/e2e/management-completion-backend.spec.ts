import { test, expect } from '@playwright/test';
import { installProductBackend } from './product-backend-fixture';

test('Backend completion sends bounded bulk and paginated notification contracts with CSRF', async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const fixture = await installProductBackend(context);
  await page.goto('/users/create');
  await page.getByRole('textbox', { name: '姓名', exact: true }).fill('Backend batch member');
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('batch@example.test');
  await page.getByLabel('初始密码', { exact: true }).fill('InitialPassword2026!');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page).toHaveURL(/\/users\/detail\?id=/);
  await page.goto('/users');
  await page.getByRole('checkbox', { name: '选择当前页', exact: true }).press('Space');
  await page.getByRole('button', { name: '批量停用', exact: true }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: '确认修改', exact: true })
    .click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(page.getByRole('main')).toContainText('成功');
  expect(fixture.writes).toContainEqual({
    path: '/users/batch-status',
    method: 'POST',
    csrf: 'product-csrf',
  });
  await page.goto('/notifications');
  await expect(page.getByRole('main')).toContainText('Backend batch member');
  await page.getByRole('checkbox', { name: '选择当前页消息', exact: true }).press('Space');
  await page.getByRole('button', { name: '将选中通知标为已读', exact: true }).click();
  await expect(page.getByRole('main')).toContainText('0 条未读');
  expect(fixture.writes.every((write) => write.csrf === 'product-csrf')).toBe(true);
});

test('Backend account security revokes other sessions and changes password without Mock fallback', async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const fixture = await installProductBackend(context);
  await page.goto('/account');
  await expect(page.getByText('Other browser', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '退出其他会话', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByText('Other browser', { exact: true })).toHaveCount(0);
  await page.getByLabel('当前密码', { exact: true }).fill('BackendPassword2026!');
  await page.getByLabel('新密码', { exact: true }).fill('BackendNewPassword2026!');
  await page.getByRole('button', { name: '修改密码', exact: true }).click();
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  expect(fixture.writes).toContainEqual({
    path: '/auth/password',
    method: 'POST',
    csrf: 'product-csrf',
  });
  expect(fixture.writes).toContainEqual({
    path: '/auth/sessions/revoke-others',
    method: 'POST',
    csrf: 'product-csrf',
  });
  expect(await page.evaluate(() => localStorage.getItem('clouddrive.auth-mock'))).toBeNull();
});
