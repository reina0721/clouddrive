import { saveEvidenceScreenshot } from './evidence-screenshot';
import { test, expect, type Page } from '@playwright/test';
import { e2eBaseUrl } from './base-url';
import AxeBuilder from '@axe-core/playwright';
import { defaultPreferences, PREFERENCES_VERSION } from '@clouddrive/surface/preferences-model';

test.use({ storageState: { cookies: [], origins: [] } });

async function login(page: Page) {
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('demo@community.test');
  await page.getByLabel('密码', { exact: true }).fill('CommunityDemo2026!');
  await page.getByRole('button', { name: '登录', exact: true }).click();
}

test('Anonymous deep link preserves destination; login restores identity; logout protects content', async ({
  page,
}) => {
  await page.goto('/settings/accessibility?source=auth#motion');
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(
    '/settings/accessibility?source=auth',
  );
  expect(new URL(page.url()).hash).not.toBe('');
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '显示密码', exact: true }).click();
  await expect(page.getByLabel('密码', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: '隐藏密码', exact: true }).click();
  await login(page);
  await expect(page).toHaveURL(/\/settings\/accessibility\?source=auth#motion$/);
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await expect(page.getByText('demo@community.test', { exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  await page.goto('/reference-resources');
  await expect(page).toHaveURL(/\/login\?returnTo=/);
});

test('Registration validates confirmation, displays success and persists only salted password digest', async ({
  page,
}) => {
  await page.goto('/register');
  await page.getByRole('textbox', { name: '姓名', exact: true }).fill('Auth Review');
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('review@example.test');
  await page.getByLabel('密码', { exact: true }).fill('UniqueDemoPass2026!');
  await page.getByLabel('确认密码', { exact: true }).fill('DifferentPassword!');
  await page.getByRole('button', { name: '创建账户', exact: true }).click();
  await expect(page.getByText('两次输入的密码不一致。', { exact: true })).toBeVisible();
  await expect(page.getByLabel('确认密码', { exact: true })).toBeFocused();
  await page.getByLabel('确认密码', { exact: true }).fill('UniqueDemoPass2026!');
  await page.getByRole('button', { name: '创建账户', exact: true }).click();
  await expect(page.getByText('账户已创建', { exact: true })).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('clouddrive.auth-mock'));
  expect(stored).not.toContain('UniqueDemoPass2026!');
  expect(stored).toMatch(/"digest":"[0-9a-f]{64}"/);
  await page.getByRole('button', { name: '开始使用', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await expect(page.getByRole('menu').getByText('Auth Review', { exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('review@example.test');
  await page.getByLabel('密码', { exact: true }).fill('UniqueDemoPass2026!');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
});

for (const width of [320, 390, 768, 1440, 2048]) {
  test(`Authentication layouts remain accessible at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ['/login', '/register', '/session-expired', '/welcome']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Open Next.js Dev Tools', exact: true }),
      ).toHaveCount(0);
      await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(axe.violations).toEqual([]);
      if (path === '/login' || path === '/register')
        await saveEvidenceScreenshot(page, {
          path: `authentication/${path.slice(1)}-${width}.png`,
          fullPage: true,
        });
      if ((width === 320 || width === 1440) && (path === '/login' || path === '/register'))
        await expect.soft(page).toHaveScreenshot(`authentication-${path.slice(1)}-${width}.png`, {
          fullPage: true,
        });
    }
  });
}

test('Invalid credentials keep the form usable and reject external return targets', async ({
  page,
}) => {
  await page.goto('/login?returnTo=https%3A%2F%2Fexample.com');
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('demo@community.test');
  await page.getByLabel('密码', { exact: true }).fill('WrongPassword2026!');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByText('邮箱或密码不正确，请重试。', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '登录', exact: true })).toBeEnabled();
  await login(page);
  await expect(page).toHaveURL(`${e2eBaseUrl}/`);
});

test('Existing sessions redirect guest routes and corrupt demo records can be repaired explicitly', async ({
  page,
}) => {
  await page.goto('/login');
  await login(page);
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
  await page.goto('/login?returnTo=%2Fsettings%2Fnotifications');
  await expect(page).toHaveURL(`${e2eBaseUrl}/settings/notifications`);
  await page.evaluate(() => localStorage.setItem('clouddrive.auth-mock', 'damaged-record'));
  await page.goto('/login');
  await expect(
    page.getByText('认证响应或本地记录无效，请联系维护者。', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('clouddrive.auth-mock'))).toBe(
    'damaged-record',
  );
  await page.evaluate(() => localStorage.removeItem('clouddrive.auth-mock'));
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '邮箱', exact: true })).toBeVisible();
});

test('The authority password control supports keyboard visibility and preserves its input', async ({
  page,
}) => {
  await page.goto('/ui-elements/forms');
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await login(page);
  const password = page.getByLabel('密码输入', { exact: true });
  await password.fill('KeyboardRetained2026!');
  await password.focus();
  await page.keyboard.press('Tab');
  const show = page.getByRole('button', { name: '显示密码', exact: true }).first();
  await expect(show).toBeFocused();
  await page.keyboard.press('Space');
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('KeyboardRetained2026!');
  const hide = page.getByRole('button', { name: '隐藏密码', exact: true });
  await hide.press('Space');
  await expect(password).toHaveAttribute('type', 'password');
});

test('Session expiry removes protected content and returns to the expired-session form', async ({
  page,
}) => {
  await page.goto('/login');
  await login(page);
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const key = 'clouddrive.auth-mock';
    // Change only the expiration in this test's known persisted fixture.
    const record = localStorage.getItem(key);
    if (!record) throw new Error('Expected the established demo session');
    localStorage.setItem(
      key,
      record.replace(/"expiresAt":\d+/, `"expiresAt":${Date.now() + 2000}`),
    );
  });
  await page.reload();
  await expect(page).toHaveURL(/\/session-expired\?returnTo=/);
  await expect(page.getByText('会话已过期', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
});

test('Logout synchronizes other tabs and clears private records while retaining device preferences', async ({
  page,
  context,
}) => {
  await page.goto('/login');
  await login(page);
  await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/settings');
  await expect(second.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem('clouddrive.test-private', JSON.stringify({ secret: 'previous-owner' }));
    sessionStorage.setItem('clouddrive.test-private', 'previous-owner');
  });
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(second).toHaveURL(/\/login\?returnTo=/);
  expect(await page.evaluate(() => localStorage.getItem('clouddrive.test-private'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('clouddrive.test-private'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('clouddrive.shell'))).not.toBeNull();
  await second.close();
});

for (const width of [320, 1440]) {
  test(`English dark authentication respects reduced motion at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/register');
    await page.getByRole('button', { name: '切换语言', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.getByRole('button', { name: 'Switch theme', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(
      page.getByRole('heading', { name: 'Create your account', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
    await saveEvidenceScreenshot(page, {
      path: `authentication/register-en-dark-${width}.png`,
      fullPage: true,
    });
  });
}

test('Large English dark mobile registration keeps password entry usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addInitScript(
    ({ preferences, version }) => {
      localStorage.setItem(
        'clouddrive.shell',
        JSON.stringify({
          version,
          state: {
            preferences: {
              ...preferences,
              appearance: { ...preferences.appearance, fontScale: 'large', themeMode: 'dark' },
              localeRegion: { ...preferences.localeRegion, language: 'en' },
            },
          },
        }),
      );
    },
    { preferences: defaultPreferences, version: PREFERENCES_VERSION },
  );
  await page.goto('/register');
  const password = page.getByLabel('Confirm password', { exact: true });
  await password.fill('LargeMobileDemo2026!');
  await expect(password).toHaveValue('LargeMobileDemo2026!');
  const box = await password.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(80);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
  await saveEvidenceScreenshot(page, {
    path: 'authentication/register-320-en-dark-large.png',
    fullPage: true,
  });
  await expect.soft(page).toHaveScreenshot('authentication-register-320-en-dark-large.png', {
    fullPage: true,
  });
});
