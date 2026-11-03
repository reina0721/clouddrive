import { expect, test, type Page } from '@playwright/test';

/** 系统管理闭环：菜单业务覆盖真正作用于侧栏、部门增改与删除保护、权限只读。 */

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function clearOverrides(page: Page) {
  await page.evaluate(() => window.localStorage.removeItem('clouddrive.navigation-admin'));
}

test('菜单标题覆盖与隐藏立即作用于侧栏', async ({ page }) => {
  await ready(page, '/system/menus');
  await clearOverrides(page);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');

  const primary = page.getByRole('navigation', { name: '主导航' });
  await expect(primary.getByRole('link', { name: '用户管理', exact: true })).toBeVisible();

  // 1) 标题覆盖
  await page.getByPlaceholder('按标题、路由地址或权限标识搜索').fill('用户管理');
  await page
    .getByRole('row', { name: /用户管理/ })
    .getByRole('button', { name: '修改', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: '修改菜单展示元数据' })).toBeVisible();
  await dialog.getByLabel('标题覆盖').fill('成员');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(primary.getByRole('link', { name: '成员', exact: true })).toBeVisible();
  await expect(primary.getByRole('link', { name: '用户管理', exact: true })).toHaveCount(0);

  // 2) 隐藏（标题已改为“成员”，搜索词同步更新）
  await page.getByPlaceholder('按标题、路由地址或权限标识搜索').fill('成员');
  await page
    .getByRole('row', { name: /成员/ })
    .getByRole('button', { name: '修改', exact: true })
    .click();
  const hiddenSwitch = dialog.getByRole('switch');
  await hiddenSwitch.focus();
  await hiddenSwitch.press('Space');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(primary.getByRole('link', { name: '成员', exact: true })).toHaveCount(0);

  // 3) 刷新后保持（同一 Host store）
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(
    page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '成员', exact: true }),
  ).toHaveCount(0);

  await clearOverrides(page);
});

test('部门新增与删除保护', async ({ page }) => {
  await ready(page, '/system/departments');
  await page.getByRole('button', { name: '新增部门', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('部门名称').fill('体验验证部');
  await dialog.getByLabel('负责人').fill('验证员');
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('row', { name: /体验验证部/ })).toBeVisible();

  // 有下级的部门不允许删除：按钮禁用，或提供明确原因。
  const parentRow = page.getByRole('row', { name: /技术中心/ }).first();
  const deleteButton = parentRow.getByRole('button', { name: '删除', exact: true });
  if ((await deleteButton.count()) > 0) {
    await expect(deleteButton).toBeDisabled();
  } else {
    await expect(parentRow.getByText('存在下级部门，需先删除或迁出下级部门。')).toBeVisible();
  }
});

test.describe('read-only access', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('操作员没有 settings.update：系统管理只读并说明原因', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /操作员/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await ready(page, '/system/menus');
    await expect(page.getByText('只读模式', { exact: true })).toBeVisible();
    await expect(page.getByText(/没有 settings\.update 权限/)).toBeVisible();
    const modify = page
      .getByRole('row', { name: /用户管理/ })
      .getByRole('button', { name: '修改', exact: true });
    if ((await modify.count()) > 0) await expect(modify).toBeDisabled();
  });
});
