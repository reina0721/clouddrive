import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readPreviewAccess } from './reading-fixture';

for (const english of [false, true])
  test(`Direct file entry owns lock messages and recovers password verification: ${english ? 'en' : 'zh'}`, async ({
    page,
    browser,
  }, info) => {
    const access = readPreviewAccess();
    await page.goto('/login?returnTo=%2Fhome');
    await page.getByLabel('邮箱', { exact: true }).fill(access.username);
    await page.getByLabel('密码', { exact: true }).fill(access.password);
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
    // 只带会话 Cookie 的新运行时直接进入文件区；不能依赖先挂载认证页或管理 Shell。
    const context = await browser.newContext({
      storageState: { cookies: (await page.context().storageState()).cookies, origins: [] },
      locale: 'zh-CN',
      viewport: { width: 390, height: 844 },
    });
    const file = await context.newPage();
    try {
      await file.goto(access.origin + '/home');
      await expect(file).toHaveURL(/\/home$/);
      await file.getByRole('button', { name: '当前用户', exact: true }).click();
      if (english) {
        await file.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
        await file.getByRole('menuitemradio', { name: 'English', exact: true }).click();
        await expect(file.locator('html')).toHaveAttribute('lang', 'en');
        await file.getByRole('button', { name: 'Current user', exact: true }).click();
      }
      await file
        .getByRole('menuitem', { name: english ? 'Lock screen' : '锁定屏幕', exact: true })
        .click();
      const lock = file.getByRole('dialog', { name: english ? 'Locked' : '锁屏', exact: true });
      await expect(lock).toBeVisible();
      await expect(lock).not.toContainText(/shell\.lock\.|auth\./);
      const password = lock.getByLabel(english ? 'Account password' : '账号密码', { exact: true });
      await expect(password).toBeFocused();
      const submit = lock.getByRole('button', { name: english ? 'Unlock' : '解锁', exact: true });
      await submit.click();
      await expect(
        lock.getByText(english ? 'Enter your password.' : '请输入密码。', { exact: true }),
      ).toBeVisible();
      await expect(
        lock.getByRole('button', { name: english ? 'Show password' : '显示密码', exact: true }),
      ).toBeVisible();
      const accessibility = await new AxeBuilder({ page: file })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(accessibility.violations).toEqual([]);
      await file.screenshot({
        path: info.outputPath(`file-lock-${english ? 'en' : 'zh'}.png`),
        animations: 'disabled',
      });
      // 注入一次不可用响应验证恢复；不向真实后端发送错误密码或消耗失败预算。
      const verify = '**/api/console/v1/auth/password/verify';
      await file.route(verify, (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'unavailable' } }),
        }),
      );
      await password.fill(access.password);
      await submit.click();
      await expect(lock).toBeVisible();
      await expect(
        lock.getByText(
          english
            ? 'Authentication or local storage is temporarily unavailable. Try again later.'
            : '认证服务或本地存储暂时不可用，请稍后重试。',
          { exact: true },
        ),
      ).toBeVisible();
      await expect(lock).not.toContainText(/shell\.lock\.|auth\./);
      await expect(password).toBeEmpty();
      await file.unroute(verify);
      await password.fill(access.password);
      const response = file.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/console/v1/auth/password/verify' &&
          response.request().method() === 'POST',
      );
      await password.press('Enter');
      expect((await response).status()).toBe(200);
      await expect(lock).not.toBeVisible();
      await expect(file.locator('[data-file-workspace-search]')).toBeVisible();
      await expect(file).toHaveURL(/\/home$/);
    } finally {
      await context.close();
    }
  });
