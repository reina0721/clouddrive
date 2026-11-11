import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { openReadingFixtureFolder, readPreviewAccess } from './reading-fixture';
import { encodeFileFilters } from '../surfaces/src/files/search';
import AxeBuilder from '@axe-core/playwright';

async function login(page: Page) {
  const account = readPreviewAccess();
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test('登录入口围绕文件表达用途，窄屏与深色英文保持可读', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/login');
  await expect(
    page.getByRole('heading', { name: '文件有序，随时继续。', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('上传可暂停，稍后接着传', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
  const policy = (await (
    await page.request.get('/api/console/v1/auth/registration-policy')
  ).json()) as { enabled: boolean };
  await expect(page.getByRole('link', { name: '首次设置', exact: true })).toHaveCount(0);
  if (!policy.enabled) {
    await expect(page.getByRole('link', { name: '注册账户', exact: true })).toHaveCount(0);
    await expect(
      page.getByText('公开注册已关闭。如需账户，请联系系统管理员。', { exact: true }),
    ).toBeVisible();
  }
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('entry-desktop.png'), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('entry-mobile.png'), fullPage: false });
  await page.getByRole('button', { name: /语言/ }).click();
  await page.getByRole('button', { name: /theme/i }).click();
  const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
  await expect(signIn).toBeVisible();
  await signIn.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations({ subtree: true }).map((animation) => animation.finished),
    );
  });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath('entry-dark-english-mobile.png'),
    fullPage: false,
  });
});

test('注册信息暂时不可用时仍能正常登录', async ({ page }) => {
  await page.route('**/api/console/v1/auth/registration-policy', (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto('/login');
  await expect(page.getByText('需要账户？请联系站点管理员。', { exact: true })).toBeVisible();
  const account = readPreviewAccess();
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test('公共工作区保留内容高度与关闭入口，普通表单保持确认语义', async ({ page }, info) => {
  await login(page);
  await page.goto('/ui-elements/forms');
  await page.getByLabel('工具栏中的页码', { exact: true }).fill('24');
  await expect(page.getByLabel('工具栏中的页码', { exact: true })).toHaveValue('24');
  await page.goto('/ui-elements/overlays');
  const standard = page.getByRole('button', { name: 'Dialog', exact: true });
  await standard.click();
  const form = page.getByRole('dialog', { name: '编辑显示名称', exact: true });
  await expect(form.getByLabel('显示名称', { exact: true })).toBeVisible();
  await form.getByRole('button', { name: '取消', exact: true }).click();
  await expect(standard).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 720 });
  const trigger = page.getByRole('button', { name: '阅读工作区', exact: true });
  await trigger.click();
  const workspace = page.getByRole('dialog', { name: '阅读工作区', exact: true });
  expect(
    (await workspace.getByText('阅读与编辑内容区域', { exact: true }).boundingBox())?.height,
  ).toBeGreaterThan(400);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('workspace-component.png'), fullPage: false });
  await workspace.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(trigger).toBeFocused();
});

test('空文件夹给出上传入口，筛选无结果可以回到文件，回收站保留自己的语境', async ({
  page,
}, info) => {
  await login(page);
  await openReadingFixtureFolder(page, '体验验收-');
  const folder = new URL(page.url()).searchParams.get('parent')!;
  await expect(page.getByText('这里还没有文件', { exact: true })).toBeVisible();
  await expect(
    page.getByText('上传文件，或把文件拖到这里。内容会保存在当前文件夹。', { exact: true }),
  ).toBeVisible();
  const name = '阅读笔记-' + randomUUID().slice(0, 8) + '.txt';
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '上传文件', exact: true }).click();
  await (
    await chooser
  ).setFiles({ name, mimeType: 'text/plain', buffer: Buffer.from('A place for notes.') });
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  const filter = encodeURIComponent(encodeFileFilters({ scope: 'folder', extensions: ['pdf'] }));
  await page.goto(`/home?parent=${folder}&filter=${filter}`);
  await expect(page.getByText('没有找到文件', { exact: true })).toBeVisible();
  await expect(page.getByText('这里还没有文件', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '清除筛选', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('parent=' + folder + '$'));
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: name + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '移入回收站', exact: true }).click();
  await page
    .getByRole('dialog', { name: '移入回收站', exact: true })
    .getByRole('button', { name: '确认', exact: true })
    .click();
  await expect(page.getByText('这里还没有文件', { exact: true })).toBeVisible();
  await page.goto('/home?trash=true&search=' + randomUUID());
  await expect(page.getByText('没有找到文件', { exact: true })).toBeVisible();
  await expect(page.getByText('回收站为空', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '上传文件', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '清除筛选', exact: true }).click();
  await expect(page).toHaveURL(/trash=true/);
  await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('recoverable-file.png'), fullPage: false });
});
