import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readPreviewAccess } from './reading-fixture';

test('Application language and week preference reach real audit date controls', async ({
  page,
}, info) => {
  const access = readPreviewAccess();
  await page.goto('/login?returnTo=%2Fsettings%2Flocale');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/locale$/);
  const week = page.getByRole('radiogroup', { name: '一周起始日', exact: true });
  await week.getByText('周日', { exact: true }).click();
  await expect(week.getByRole('radio', { name: '周日', exact: true })).toBeChecked();
  await page.goto('/audit-logs?from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-13T23%3A59%3A59.999Z');
  await page.getByText('筛选条件', { exact: true }).click();
  const dates = page.locator('[data-slot="date-picker"]');
  await expect(dates).toHaveCount(2);
  const facts = () =>
    dates.evaluateAll((fields) =>
      fields.map((field) =>
        [...field.querySelectorAll('[role="spinbutton"]')]
          .map((segment) => segment.getAttribute('aria-valuenow'))
          .sort(),
      ),
    );
  const before = await facts();
  expect(before).toEqual([
    ['1', '10', '2026'],
    ['10', '13', '2026'],
  ]);
  const url = page.url();
  await dates.first().getByRole('button').click();
  await expect(page.getByRole('dialog').getByRole('gridcell').first()).toHaveAccessibleName(
    /星期日/,
  );
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '切换语言', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await facts()).toEqual(before);
  await expect(page).toHaveURL(url);
  await dates.first().getByRole('button').click();
  await expect(page.getByRole('dialog').getByText('October 2026', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('gridcell').first()).toHaveAccessibleName(
    /Sunday/,
  );
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath('audit-calendar-english-sunday.png'),
    animations: 'disabled',
  });
});
