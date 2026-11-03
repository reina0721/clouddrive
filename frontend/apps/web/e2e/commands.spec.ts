import { expect, test } from '@playwright/test';

test('命令菜单聚合插件注册命令：Ctrl+K → 新建资源命令执行跳转', async ({ page }) => {
  await page.goto('/reference-resources');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(
    page.getByRole('heading', { level: 1, name: '参考资源', exact: true }),
  ).toBeVisible();
  // Ctrl+K 打开命令菜单。
  await page.keyboard.press('Control+K');
  const search = page.getByRole('searchbox', { name: '搜索命令' });
  await expect(search).toBeVisible();
  // 插件注册的页面命令 "新建资源" 出现在结果中。
  await search.fill('新建资源');
  const option = page.getByRole('option', { name: /新建资源/ }).first();
  await expect(option).toBeVisible();
  // 激活（点击选项，与键盘 Enter 同一条 onAction 路径）→ 导航到创建页。
  await option.click();
  await expect(page).toHaveURL(/\/reference-resources\/create/);
});
