import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

/** 重置偏好与用户列布局 store（每个测试的 context 本已隔离，这里保证默认值可预期）。 */
async function resetPreferences(page: Page) {
  await page.goto('/settings/data-display');
  await page.evaluate(() => {
    window.localStorage.removeItem('clouddrive.shell');
    window.localStorage.removeItem('clouddrive.plugin.users.column-layout');
    window.localStorage.removeItem('clouddrive.plugin.audit.column-layout');
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
}

async function readDownload(page: Page, trigger: () => Promise<void>): Promise<string> {
  const downloadPromise = page.waitForEvent('download');
  await trigger();
  const download = await downloadPromise;
  const filePath = await download.path();
  if (!filePath) throw new Error('download 未落地');
  return readFileSync(filePath, 'utf8');
}

test('用户列设置：隐藏邮箱列立即生效并在刷新后保持', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/users?pageSize=50');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const grid = page.getByRole('grid', { name: '用户目录' });
  await expect(grid.getByRole('columnheader', { name: '邮箱' })).toBeVisible();

  await page.getByRole('button', { name: '列设置' }).click();
  const dialog = page.getByRole('dialog', { name: '列设置' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('始终显示', { exact: true })).toBeVisible();
  // HeroUI Checkbox 的可见 label 承担点击（input 被 control 覆盖）。
  await dialog.getByText('邮箱', { exact: true }).click();
  await dialog.getByRole('button', { name: '完成' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(grid.getByRole('columnheader', { name: '邮箱' })).toHaveCount(0);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(
    page.getByRole('grid', { name: '用户目录' }).getByRole('columnheader', { name: '邮箱' }),
  ).toHaveCount(0);
  // 恢复默认列后邮箱列回来。
  await page.getByRole('button', { name: '列设置' }).click();
  await page
    .getByRole('dialog', { name: '列设置' })
    .getByRole('button', { name: '恢复默认列' })
    .click();
  await page.getByRole('dialog', { name: '列设置' }).getByRole('button', { name: '完成' }).click();
  await expect(
    page.getByRole('grid', { name: '用户目录' }).getByRole('columnheader', { name: '邮箱' }),
  ).toBeVisible();
});

test('用户密度切换：三档写入偏好并改变真实行内边距', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/users?pageSize=50');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const rowHeader = page.getByRole('grid', { name: '用户目录' }).getByRole('rowheader').first();
  const densityTrigger = page.getByRole('button', { name: /表格密度/ });
  await expect(densityTrigger).toContainText('标准');
  const standardPadding = await rowHeader.evaluate(
    (element) => getComputedStyle(element).paddingTop,
  );
  await densityTrigger.click();
  await page.getByRole('option', { name: '紧凑' }).click();
  await expect(densityTrigger).toContainText('紧凑');
  const compactPadding = await rowHeader.evaluate(
    (element) => getComputedStyle(element).paddingTop,
  );
  expect(compactPadding).not.toBe(standardPadding);
  // 偏好写入 Host 偏好 store（全局表格密度），刷新后仍生效。
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('button', { name: /表格密度/ })).toContainText('紧凑');
});

test('用户 CSV 导出：当前页与仅所选行，引号按 RFC 4180 转义', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/users?page=1&pageSize=10');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const grid = page.getByRole('grid', { name: '用户目录' });
  await expect(grid.getByRole('row')).toHaveCount(11);

  const pageCsv = await readDownload(page, async () => {
    await page.getByRole('button', { name: '导出用户数据' }).click();
    await page.getByRole('menuitem', { name: /导出当前页（10 行）/ }).click();
  });
  const pageLines = pageCsv
    .replace(/^\uFEFF/, '')
    .trimEnd()
    .split('\r\n');
  expect(pageLines[0]).toBe('姓名,邮箱,状态,角色,创建时间');
  expect(pageLines).toHaveLength(11);
  await expect(page.getByText('已导出 10 行 CSV')).toBeVisible();

  // 仅导出所选：点击两行（状态单元格，避免触发行内链接）。
  await grid.getByRole('row').nth(1).getByText('启用').click();
  await grid.getByRole('row').nth(2).getByText('启用').click();
  await expect(page.getByText('已选择 2 位用户')).toBeVisible();
  const selectedCsv = await readDownload(page, async () => {
    await page.getByRole('button', { name: '导出用户数据' }).click();
    await page.getByRole('menuitem', { name: /导出所选（2 行）/ }).click();
  });
  const selectedLines = selectedCsv
    .replace(/^\uFEFF/, '')
    .trimEnd()
    .split('\r\n');
  expect(selectedLines).toHaveLength(3);
  expect(selectedLines[0]).toBe('姓名,邮箱,状态,角色,创建时间');
});

test('审计列设置：隐藏操作对象列并持久化', async ({ page }) => {
  await resetPreferences(page);
  await page.goto('/audit-logs');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const grid = page.getByRole('grid', { name: '审计日志' });
  await expect(grid.getByRole('columnheader', { name: '操作对象' })).toBeVisible();
  await page.getByRole('button', { name: '列设置' }).click();
  const dialog = page.getByRole('dialog', { name: '列设置' });
  await expect(dialog.getByRole('checkbox', { name: '操作类型' })).toBeDisabled();
  await dialog.getByText('操作对象', { exact: true }).click();
  await dialog.getByRole('button', { name: '完成' }).click();
  await expect(grid.getByRole('columnheader', { name: '操作对象' })).toHaveCount(0);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(
    page.getByRole('grid', { name: '审计日志' }).getByRole('columnheader', { name: '操作对象' }),
  ).toHaveCount(0);
});

test('审计 CSV 导出当前页；所选存在时提供仅所选导出', async ({ page }) => {
  await resetPreferences(page);
  // 审计记录由真实受审计动作产生：先对一位用户做一次批量状态修改。
  await page.goto('/users?pageSize=10');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const usersGrid = page.getByRole('grid', { name: '用户目录' });
  await usersGrid.getByRole('row').nth(1).getByText('启用').click();
  await expect(page.getByText('已选择 1 位用户')).toBeVisible();
  await page.getByRole('button', { name: '批量停用' }).click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toContainText('不能停用当前账号');
  await confirmation.getByRole('button', { name: '确认修改' }).click();
  await expect(confirmation).toBeHidden();
  await expect(page.getByRole('main')).toContainText('成功');

  await page.goto('/audit-logs');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const grid = page.getByRole('grid', { name: '审计日志' });
  await expect(grid.getByRole('row').nth(1)).toBeVisible();
  await page.getByRole('button', { name: '导出审计数据' }).click();
  await expect(page.getByRole('menuitem', { name: /导出所选/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  const csv = await readDownload(page, async () => {
    await page.getByRole('button', { name: '导出审计数据' }).click();
    await page.getByRole('menuitem', { name: /导出当前页/ }).click();
  });
  const lines = csv
    .replace(/^\uFEFF/, '')
    .trimEnd()
    .split('\r\n');
  expect(lines[0]).toBe('操作时间,操作类型,操作主体,操作对象,操作结果');
  const rowCount = await grid.getByRole('row').count();
  expect(lines).toHaveLength(rowCount);

  // 选中一行后提供"仅所选"导出，并以 aria-live 播报选中条数。
  await grid
    .getByRole('row')
    .nth(1)
    .getByText(/成功|失败/)
    .first()
    .click();
  await expect(page.getByText('已选择 1 条记录')).toBeVisible();
  const selectedCsv = await readDownload(page, async () => {
    await page.getByRole('button', { name: '导出审计数据' }).click();
    await page.getByRole('menuitem', { name: /导出所选（1 行）/ }).click();
  });
  const selectedLines = selectedCsv
    .replace(/^\uFEFF/, '')
    .trimEnd()
    .split('\r\n');
  expect(selectedLines).toHaveLength(2);
});

test('Showcase 树形行：aria-expanded、tree depth 与行数联动', async ({ page }) => {
  await page.goto('/ui-elements/data');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const tree = page.getByRole('grid', { name: '树形行演示' });
  await expect(tree.getByRole('row')).toHaveCount(4);
  // 名称在展开/收起之间切换，因此用行名定位稳定 toggle。
  const toggle = tree.getByRole('button', { name: /Design Tokens/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(tree.getByRole('row').nth(1)).toHaveAttribute('data-tree-depth', '0');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(tree.getByRole('row')).toHaveCount(6);
  await expect(tree.getByRole('row').nth(2)).toHaveAttribute('data-tree-depth', '1');
  // 键盘：Enter 收起。
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(tree.getByRole('row')).toHaveCount(4);
});

test('Showcase CSV 导出：下载内容包含表头与 RFC 4180 转义值', async ({ page }) => {
  await page.goto('/ui-elements/data');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const csv = await readDownload(page, async () => {
    await page.getByRole('button', { name: '导出演示数据' }).click();
    await page.getByRole('menuitem', { name: /导出 CSV（3 行）/ }).click();
  });
  const content = csv.replace(/^\uFEFF/, '');
  expect(content.startsWith('UI Element,职责层,备注\r\n')).toBe(true);
  expect(content).toContain('"稳定, ""已验证"""');
  expect(content).toContain('"含换行\n的备注"');
  await expect(page.getByText('已导出 3 行 CSV')).toBeVisible();
});

test('Showcase 列设置：隐藏备注列同时影响表格与导出列', async ({ page }) => {
  await page.goto('/ui-elements/data');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const toolbar = page.getByRole('toolbar', { name: '演示表格工具栏' });
  await expect(toolbar).toBeVisible();
  const table = page.getByRole('grid', { name: 'CSV 导出演示' });
  await expect(table.getByRole('columnheader', { name: '备注' })).toBeVisible();
  await toolbar.getByRole('button', { name: '列设置' }).click();
  const dialog = page.getByRole('dialog', { name: '列设置' });
  await expect(dialog.getByRole('checkbox', { name: 'UI Element' })).toBeDisabled();
  await dialog.getByText('备注', { exact: true }).click();
  await dialog.getByRole('button', { name: '完成' }).click();
  await expect(table.getByRole('columnheader', { name: '备注' })).toHaveCount(0);
  const csv = await readDownload(page, async () => {
    await page.getByRole('button', { name: '导出演示数据' }).click();
    await page.getByRole('menuitem', { name: /导出 CSV/ }).click();
  });
  expect(csv.replace(/^\uFEFF/, '')).toMatch(/^UI Element,职责层\r\n/);
});
