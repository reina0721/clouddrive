import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { saveEvidenceScreenshot } from './evidence-screenshot';
import { waitForVisualReadiness } from './visual-readiness';

test('Account has permanent inline forms, validates, resets and saves profile with Enter', async ({
  page,
}) => {
  await page.goto('/account');
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText([
    '个人资料',
    '账户安全',
    '有效登录会话',
  ]);
  await expect(page.getByRole('main').locator('form')).toHaveCount(2);
  await expect(page.getByRole('main').locator('footer.sticky')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const name = page.getByLabel('姓名', { exact: true });
  const initial = await name.inputValue();
  await name.fill('');
  await page.getByRole('button', { name: '保存资料', exact: true }).click();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(name).toHaveValue(initial);
  await name.fill('Inline account review');
  await page.getByLabel('邮箱', { exact: true }).press('Enter');
  await expect(page.getByText('个人资料已保存', { exact: true })).toBeVisible();
  await expect(name).toHaveValue('Inline account review');
  await name.fill('Unsaved second edit');
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await expect(name).toHaveValue('Inline account review');
  await page.reload();
  await expect(name).toHaveValue('Inline account review');
});

test('Inline profile and password each retain navigation protection and clear/reset independently', async ({
  page,
}) => {
  await page.goto('/account');
  const name = page.getByLabel('姓名', { exact: true });
  const password = page.getByLabel('当前密码', { exact: true });
  await name.fill('Unsaved profile');
  const destination = page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '用户管理', exact: true });
  await destination.click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: '取消', exact: true }).click();
  await expect(name).toHaveValue('Unsaved profile');
  await password.fill('DisposableInput');
  await page.getByLabel('新密码', { exact: true }).fill('DisposableNewInput');
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await expect(password).toHaveValue('');
  await expect(page.getByLabel('新密码', { exact: true })).toHaveValue('');
  await expect(name).toHaveValue('Unsaved profile');
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await password.fill('AnotherDisposableInput');
  await destination.click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('alertdialog').getByRole('button', { name: '离开', exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
  await page.goto('/account');
  await expect(password).toHaveValue('');
});

for (const english of [false, true]) {
  test(`Permanent account forms and session confirmation retain layout, keyboard and Axe: ${english ? 'en-dark' : 'zh-light'}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000);
    if (english) {
      await page.goto('/settings/locale');
      await page.getByRole('radio', { name: 'English', exact: true }).press('Space');
      await page.goto('/settings');
      await page.getByRole('radio', { name: 'Dark theme', exact: true }).press('Space');
    }
    for (const width of [320, 390, 768, 1440, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/account');
      await expect(
        page.getByRole('heading', { level: 1, name: english ? 'Personal account' : '个人账户' }),
      ).toBeVisible();
      await expect(page.getByRole('main').locator('form')).toHaveCount(2);
      await waitForVisualReadiness(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      expect(
        await page
          .getByRole('main')
          .locator('form button[type="submit"]')
          .evaluateAll((buttons) =>
            buttons.every(
              (button) =>
                button.parentElement !== null &&
                getComputedStyle(button.parentElement).position === 'static' &&
                getComputedStyle(button.parentElement).boxShadow === 'none',
            ),
          ),
      ).toBe(true);
      const password = page.getByLabel(english ? 'Current password' : '当前密码', { exact: true });
      if (width === 1440 || width === 2560)
        expect(
          await password.evaluate((input) => input.getBoundingClientRect().width),
        ).toBeLessThan(800);
      if (width === 320 || width === 1440) {
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
              .analyze()
          ).violations,
        ).toEqual([]);
        await saveEvidenceScreenshot(page, {
          path: testInfo.outputPath(
            `account-inline-${english ? 'en-dark' : 'zh-light'}-${width}.png`,
          ),
          fullPage: true,
        });
      }
      const exit = page.getByRole('button', {
        name: english ? 'Sign out current session' : '退出当前会话',
        exact: true,
      });
      await exit.click();
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toContainText(english ? 'signs you out' : '退出当前登录');
      await waitForVisualReadiness(page);
      if (width === 320 || width === 1440)
        expect(
          (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
            .violations,
        ).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(exit).toBeFocused();
    }
  });
}
