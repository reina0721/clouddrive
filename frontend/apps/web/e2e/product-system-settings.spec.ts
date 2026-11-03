import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { saveEvidenceScreenshot } from './evidence-screenshot';
import { waitForVisualReadiness } from './visual-readiness';

test('Registration policy controls public signup and the resulting account role', async ({
  page,
}) => {
  test.setTimeout(120_000);
  async function savePolicy() {
    await page.getByRole('button', { name: '保存策略', exact: true }).click();
    await page
      .getByRole('alertdialog', { name: '确认注册策略变更', exact: true })
      .getByRole('button', { name: '保存策略', exact: true })
      .click();
    await expect(page.getByText('注册策略已保存', { exact: true })).toBeVisible();
  }
  async function logout() {
    await page.getByRole('button', { name: '当前用户', exact: true }).click();
    await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
  }
  await page.goto('/system-settings');
  const registrationSwitch = page.getByRole('switch', { name: '开放公开注册', exact: true });
  await expect(registrationSwitch).toBeChecked();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await registrationSwitch.press('Space');
  await savePolicy();
  await page.reload();
  await expect(registrationSwitch).not.toBeChecked();
  await logout();
  await page.goto('/register');
  await expect(
    page.getByText('公开注册已关闭。如需账户，请联系系统管理员。', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: '姓名', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: '前往登录', exact: true }).click();
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('demo@community.test');
  await page.getByLabel('密码', { exact: true }).fill('CommunityDemo2026!');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/system-settings');
  await page.getByText('开放公开注册', { exact: true }).click();
  await page.getByRole('button', { name: /注册账号默认角色/ }).click();
  await page.getByRole('option', { name: '操作员', exact: true }).click();
  await savePolicy();
  await logout();
  await page.goto('/register');
  await page.getByRole('textbox', { name: '姓名', exact: true }).fill('Policy signup');
  await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('signup-policy@example.test');
  await page.getByLabel('密码', { exact: true }).fill('PolicySignup2026!');
  await page.getByLabel('确认密码', { exact: true }).fill('PolicySignup2026!');
  await page.getByRole('button', { name: '创建账户', exact: true }).click();
  await expect(page.getByText('账户已创建', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '继续进入工作台', exact: true }).click();
  await expect(
    page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '用户管理', exact: true }),
  ).toBeVisible();
  await page.goto('/system-settings');
  await expect(page.getByRole('heading', { name: '没有操作权限', exact: true })).toBeVisible();
});

test('System policy retains keyboard, overlay and accessible layout across sizes and locales', async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const english of [false, true]) {
    if (english) {
      await page.goto('/settings/locale');
      await page.getByRole('radio', { name: 'English', exact: true }).press('Space');
      await page.goto('/settings');
      await page.getByRole('radio', { name: 'Dark theme', exact: true }).press('Space');
    }
    for (const width of [320, 768, 1440, 2048]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/system-settings');
      const enabled = page.getByRole('switch', {
        name: english ? 'Allow public registration' : '开放公开注册',
        exact: true,
      });
      await expect(enabled).toBeChecked();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await waitForVisualReadiness(page);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      const roleTrigger = page.getByRole('button', {
        name: english ? /Default role for registered accounts/ : /注册账号默认角色/,
      });
      await roleTrigger.click();
      await expect(
        page.getByRole('option', { name: english ? 'Administrator' : '管理员', exact: true }),
      ).toHaveAttribute('aria-disabled', 'true');
      await waitForVisualReadiness(page);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(roleTrigger).toBeFocused();
      await enabled.press('Space');
      const saveLabel = english ? 'Save policy' : '保存策略';
      await page.getByRole('button', { name: saveLabel, exact: true }).click();
      const confirmation = page.getByRole('alertdialog', {
        name: english ? 'Confirm registration policy changes' : '确认注册策略变更',
        exact: true,
      });
      await expect(confirmation).toBeVisible();
      await waitForVisualReadiness(page);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      await saveEvidenceScreenshot(page, {
        path: testInfo.outputPath(
          `system-policy-${english ? 'en-dark' : 'zh-light'}-${width}-confirm.png`,
        ),
      });
      await confirmation
        .getByRole('button', { name: english ? 'Cancel' : '取消', exact: true })
        .click();
      await expect(enabled).not.toBeChecked();
      await page
        .getByRole('button', {
          name: english ? 'Restore saved values' : '恢复已保存值',
          exact: true,
        })
        .click();
      await expect(enabled).toBeChecked();
    }
  }
  expect(errors).toEqual([]);
});
