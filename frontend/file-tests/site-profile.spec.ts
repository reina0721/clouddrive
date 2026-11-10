import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const adminPath = '/system/site-profile';

async function write<T>(page: Page, path: string, method: string, body: unknown): Promise<T> {
  const result = await page.evaluate(
    async ({ path, method, body }) => {
      const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
      const response = await fetch('/api/console/v1' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        body: JSON.stringify(body),
      });
      const value: unknown = await response.json();
      return { status: response.status, value };
    },
    { path, method, body },
  );
  expect(result.status, method + ' ' + path).toBe(200);
  return result.value as T;
}

test('站点信息保存后应用到文件区、访客登录注册和公开分享', async ({ page, browser }, info) => {
  const accessPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!accessPath, '站点信息写入只在隔离 QA 中验证。');
  const account = JSON.parse(
    (await readFile(resolve(__dirname, accessPath!), 'utf8')).replace(/^\uFEFF/, ''),
  ) as { url: string; username: string; password: string };
  const origin = new URL(account.url).origin;
  expect(origin).toBe('http://127.0.0.1:4194');
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto('/login?returnTo=%2Fsystem-settings');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '注册策略', exact: true, level: 1 }),
  ).toBeVisible();
  await page.getByRole('link', { name: '站点信息', exact: true }).click();
  await expect(page.getByRole('heading', { name: '参数设置', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '注册策略', exact: true })).toBeVisible();
  const read = async () => {
    const result = await page.evaluate(async (path) => {
      const response = await fetch('/api/console/v1' + path, { cache: 'no-store' });
      const value: unknown = await response.json();
      return { status: response.status, value };
    }, adminPath);
    expect(result.status).toBe(200);
    return result.value as { revision: number; profile: Record<string, string> };
  };
  const original = await read();
  const suffix = randomUUID().slice(0, 8);
  const name = '站点验收-' + suffix;
  const description = '公开介绍 <strong>纯文本</strong>';
  const light = '/avatar-demo.svg?site-profile=light';
  const dark = '/avatar-demo.svg?site-profile=dark';
  const favicon = '/avatar-demo.svg?site-profile=icon';
  const submit = page.getByRole('button', { name: '保存站点信息', exact: true });
  const siteName = page.getByLabel('站点名称', { exact: true });
  const lightLogo = page.getByLabel('浅色标志地址', { exact: true });
  const darkLogo = page.getByLabel('深色标志地址', { exact: true });
  const previewLight = page.getByRole('button', { name: '预览浅色标志', exact: true });
  await expect(siteName).toHaveValue(original.profile.name!);
  await expect(submit).toBeDisabled();
  await siteName.fill(name);
  await page.getByRole('button', { name: '恢复已保存值', exact: true }).click();
  await expect(siteName).toHaveValue(original.profile.name!);
  await lightLogo.fill('javascript:alert(1)');
  await expect(previewLight).toBeDisabled();
  await submit.click();
  await expect(page.getByText('请检查长度或地址格式。')).toBeVisible();
  expect((await read()).revision).toBe(original.revision);

  const guest = await browser.newContext({
    locale: 'zh-CN',
    viewport: { width: 1280, height: 850 },
  });
  let folderId: string | undefined;
  let shareId: string | undefined;
  try {
    await page.setViewportSize({ width: 375, height: 830 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await siteName.fill(name);
    await page.getByLabel('站点描述', { exact: true }).fill(description);
    await lightLogo.fill('/missing-site-profile-' + suffix + '.svg');
    await previewLight.click();
    await expect(page.locator('img[src*="missing-site-profile-"]')).toHaveCount(0);
    await lightLogo.fill(light);
    await previewLight.click();
    await expect(page.locator(`img[src="${light}"]`)).toBeVisible();
    await darkLogo.fill(dark);
    await page.getByRole('button', { name: '预览深色标志', exact: true }).click();
    await expect(page.locator(`img[src="${dark}"]`)).toBeVisible();
    await page.getByLabel('浏览器图标地址', { exact: true }).fill(favicon);
    await page.getByLabel('使用条款链接', { exact: true }).fill('/terms');
    await page.getByLabel('隐私政策链接', { exact: true }).fill('https://example.test/privacy');
    await page.screenshot({
      path: info.outputPath('site-profile-mobile.png'),
      animations: 'disabled',
    });
    await submit.click();
    await expect(page.getByText('站点信息已保存', { exact: true })).toBeVisible();
    await expect(page).toHaveTitle(name);
    await expect(page.locator('head link[rel="icon"]')).toHaveAttribute('href', favicon);
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.getByRole('heading', { name: '参数设置', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath('site-profile-desktop.png'),
      animations: 'disabled',
    });
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
    await page.goto('/home');
    await expect(
      page.getByRole('link', { name, exact: true }).filter({ visible: true }),
    ).toBeVisible();

    const anonymous = await guest.newPage();
    await anonymous.goto(origin + '/login');
    await expect(anonymous).toHaveTitle(name);
    await expect(anonymous.getByRole('link', { name: '使用条款', exact: true })).toHaveAttribute(
      'href',
      '/terms',
    );
    await expect(anonymous.getByRole('link', { name: '隐私政策', exact: true })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    await expect(anonymous.locator(`img[src="${light}"]`)).toBeVisible();
    await anonymous.getByRole('button', { name: /主题/ }).click();
    await expect(anonymous.locator(`img[src="${dark}"]`)).toBeVisible();
    await anonymous.goto(origin + '/register');
    await expect(anonymous.getByRole('link', { name: '使用条款', exact: true })).toBeVisible();
    await expect(anonymous.getByRole('link', { name: '隐私政策', exact: true })).toBeVisible();

    const folder = await write<{ id: string }>(page, '/native/files/folders', 'POST', {
      parentId: '',
      name,
    });
    folderId = folder.id;
    const share = await write<{ id: string; token: string }>(page, '/native/files/shares', 'POST', {
      rootId: folder.id,
      title: '公开站点验收',
      password: '',
      permissions: {
        browse: true,
        preview: true,
        download: true,
        create: false,
        upload: false,
        modify: false,
        rename: false,
        move: false,
        copy: false,
        delete: false,
      },
    });
    shareId = share.id;
    await anonymous.goto(origin + '/share#token=' + encodeURIComponent(share.token));
    await expect(
      anonymous.getByRole('heading', { name: '公开站点验收', exact: true }),
    ).toBeVisible();
    await expect(anonymous.getByRole('link', { name, exact: true })).toBeVisible();
    await expect(anonymous.getByText(description, { exact: true })).toBeVisible();
  } finally {
    try {
      await guest.close();
      if (shareId)
        await write(page, '/native/files/shares/' + shareId + '/revoke', 'POST', undefined);
      if (folderId) await write(page, '/native/files/' + folderId + '/trash', 'POST', undefined);
    } finally {
      const current = await read();
      if (current.profile.name === name) {
        await write(page, adminPath, 'PUT', {
          revision: current.revision,
          profile: original.profile,
        });
      }
    }
  }
});
