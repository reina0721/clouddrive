import { expect, test } from '@playwright/test';

test('Date entry and calendar messages follow the selected application language', async ({
  page,
}, info) => {
  await page.clock.setFixedTime(new Date('2026-10-09T04:00:00Z'));
  await page.goto('/ui-elements/forms');
  const field = page
    .locator('.ui-field')
    .filter({ has: page.getByText('DatePicker', { exact: true }) });
  await field.evaluate((element) =>
    element.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  await expect(field).toContainText('年');
  await page.getByRole('button', { name: '切换语言', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(field).toContainText('yyyy');
  await expect(field).not.toContainText('年');
  await field.getByRole('button').click();
  await expect(page.getByRole('dialog').getByText('October 2026', { exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('calendar-application-english.png'),
    animations: 'disabled',
  });
});

test('Calendar week preference applies to audit dates without changing their URL facts', async ({
  page,
}) => {
  await page.goto('/settings/locale');
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
  await expect(page.getByRole('dialog').getByRole('gridcell').first()).toHaveAccessibleName(
    /Sunday/,
  );
});
