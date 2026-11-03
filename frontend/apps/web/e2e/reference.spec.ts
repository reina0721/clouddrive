import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('Reference 工作台覆盖筛选、Master-Detail 与侧栏布局契约', async ({ page }) => {
  await page.goto('/page-archetypes/resource-list');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('高密度数据工作台');
  // 默认每页 20（数据展示全局默认）→ 首页 20 数据行 + 1 表头。
  await expect(page.getByRole('row')).toHaveCount(21);

  await page.getByRole('button', { name: '全部 状态', exact: true }).click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  const dataRows = page.getByRole('grid').getByRole('row');
  const selectedRecordId = await dataRows.nth(2).getAttribute('data-key');
  expect(selectedRecordId).not.toBeNull();
  await dataRows.nth(2).click();
  await expect(dataRows.nth(2)).toHaveAttribute('data-selected', 'true');
  await expect(page.getByRole('complementary').nth(1)).toContainText(selectedRecordId!);

  await dataRows.nth(3).focus();
  await page.keyboard.press('Enter');
  await expect(dataRows.nth(3)).toHaveAttribute('data-selected', 'true');
  await expect(page.getByText('已选 2 条')).toBeVisible();

  await page.getByRole('columnheader', { name: /工作流/ }).click();
  await expect(page.getByRole('columnheader', { name: /工作流/ })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );

  const collapseButton = page.getByRole('button', { name: '收起侧栏' });
  await collapseButton.click();
  await expect(page.locator('.surface-shell-grid')).toHaveAttribute('data-sidebar', 'collapsed');

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('Reference 非正常状态保持可恢复语义', async ({ page }) => {
  await page.goto('/page-archetypes/resource-list');
  await page.getByRole('button', { name: '正常 场景状态', exact: true }).click();
  await page.getByRole('option', { name: 'Partial Error' }).click();
  await expect(page.getByText('部分指标不可用')).toBeVisible();
  await expect(page.getByRole('grid')).toBeVisible();

  await page.getByRole('button', { name: 'Partial Error 场景状态', exact: true }).click();
  await page.getByRole('option', { name: 'Offline' }).click();
  await expect(page.getByText('离线快照可用')).toBeVisible();
  await page.getByRole('button', { name: '恢复正常场景' }).click();
  await expect(page.getByRole('grid')).toBeVisible();
});

test('复杂表单暴露错误、Pending 与成功状态', async ({ page }) => {
  await page.goto('/page-archetypes/create-edit');
  const nameField = page.getByLabel('场景名称');
  await nameField.fill('x');
  await page.getByRole('button', { name: '保存草稿' }).click();
  await expect(page.getByText('请输入 3 至 80 个字符。')).toBeVisible();

  await nameField.fill('Validated reference scene');
  await page.getByRole('button', { name: '保存草稿' }).click();
  await expect(page.getByRole('button', { name: '正在保存' })).toBeDisabled();
  await expect(page.getByText('草稿已保存')).toHaveCount(2);
});
