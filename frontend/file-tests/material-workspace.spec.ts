import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function login(page: Page) {
  const access = JSON.parse(
    await readFile(
      resolve(
        __dirname,
        process.env.CLOUDDRIVE_FILE_TEST_ACCESS ?? '../../.data/preview/access.json',
      ),
      'utf8',
    ),
  ) as {
    username: string;
    password: string;
  };
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('button', { name: '新建', exact: true })).toBeEnabled();
}

test('Material 导航按任务分组，真实路由保留选中语义与原生链接', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page);
  const navigation = page.getByRole('navigation', { name: '我的文件', exact: true });
  await expect(navigation.getByRole('heading', { name: '文件', exact: true })).toBeVisible();
  for (const [group, label, path] of [
    ['协作', '我的分享', 'shares'],
    ['传输与任务', '传输中心', 'transfers'],
  ] as const) {
    const link = navigation
      .getByRole('region', { name: group, exact: true })
      .getByRole('link', { name: label, exact: true });
    await expect(link).toHaveAttribute('href', '/home/' + path);
    await link.click();
    await expect(page).toHaveURL(new RegExp('/home/' + path + '$'));
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('main')).toHaveCount(1);
  }
  await navigation.getByRole('link', { name: '我的文件', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const create = page.getByRole('button', { name: '新建', exact: true });
  const shape = await create.evaluate((button) => getComputedStyle(button).borderRadius);
  expect(parseFloat(shape)).toBeGreaterThanOrEqual(20);
  await create.click();
  await expect(page.getByRole('menuitem', { name: '创建文件夹', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(create).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('material-desktop.png'), fullPage: true });
});

test('移动抽屉导航返回文件焦点，内容不横向溢出', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole('button', { name: '文件导航', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: '文件导航', exact: true });
  await expect(drawer.getByRole('heading', { name: '协作', exact: true })).toBeVisible();
  await drawer.getByRole('link', { name: '图片', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/category=image/);
  await expect(page.getByRole('main')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('material-mobile.png'), fullPage: true });
});

test('系统暗色主题覆盖内容与弹层，保留对比度和焦点', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await login(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: '创建文件夹', exact: true })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('material-dark.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '新建', exact: true })).toBeFocused();
});
