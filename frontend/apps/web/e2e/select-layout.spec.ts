import { expect, test, type Locator } from '@playwright/test';
import { defaultPreferences, PREFERENCES_VERSION } from '@clouddrive/surface/preferences-model';
import { waitForVisualReadiness } from './visual-readiness';

async function expectSeparateIndicator(trigger: Locator) {
  const geometry = await trigger.evaluate((button) => {
    const value = button.querySelector('[data-slot="select-value"]');
    const indicator = button.querySelector('[data-slot="select-default-indicator"]');
    if (!value || !indicator) throw new Error('Missing select value or indicator');
    const text = value.getBoundingClientRect();
    const arrow = indicator.getBoundingClientRect();
    return {
      gap: arrow.left - text.right,
      centerDifference: Math.abs((text.top + text.bottom - arrow.top - arrow.bottom) / 2),
    };
  });
  expect(geometry.gap, 'Selected text must end before the indicator').toBeGreaterThanOrEqual(4);
  expect(geometry.centerDifference).toBeLessThanOrEqual(1);
}

for (const scenario of [
  { width: 1440, language: 'en', theme: 'light' },
  { width: 390, language: 'zh-CN', theme: 'light' },
  { width: 320, language: 'en', theme: 'dark' },
] as const) {
  test(`Select value and indicator retain their own space: ${scenario.width}, ${scenario.language}, ${scenario.theme}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await page.addInitScript(
      ({ preferences, version, language, theme }) => {
        localStorage.setItem(
          'clouddrive.shell',
          JSON.stringify({
            version,
            state: {
              preferences: {
                ...preferences,
                appearance: { ...preferences.appearance, themeMode: theme },
                localeRegion: { ...preferences.localeRegion, language },
              },
            },
          }),
        );
      },
      { preferences: defaultPreferences, version: PREFERENCES_VERSION, ...scenario },
    );
    await page.goto('/audit-logs');
    const density = page.getByRole('button', {
      name: scenario.language === 'en' ? /Row density/ : /表格密度/,
    });
    await expect(density).toBeVisible();
    await expectSeparateIndicator(density);
    await density.press('Enter');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(density).toContainText(scenario.language === 'en' ? 'Comfortable' : '舒适');
    await expect(page.getByRole('listbox')).not.toBeVisible();
    await expectSeparateIndicator(density);
    await density.press('Enter');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('listbox').press('Escape');
    await expect(page.getByRole('listbox')).not.toBeVisible();
    await expect(density).toBeFocused();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath('audit-select.png'), animations: 'disabled' });

    await page.goto('/ui-elements/forms');
    const heading = page.locator('#element-selectfield');
    await heading.evaluate((element) =>
      element.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
    await waitForVisualReadiness(page);
    const section = heading.locator('xpath=ancestor::section[1]');
    const triggers = section.getByRole('button');
    await expect(triggers).toHaveCount(3);
    const content = await section
      .locator(':scope > [data-reveal-item]')
      .last()
      .evaluate((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          left: box.left + Number.parseFloat(style.paddingLeft),
          right: box.right - Number.parseFloat(style.paddingRight),
        };
      });
    for (let index = 0; index < 3; index += 1) {
      const trigger = triggers.nth(index);
      await expectSeparateIndicator(trigger);
      const box = await trigger.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(content.left - 1);
      expect(box!.x + box!.width, `Select ${index} must fit its content area`).toBeLessThanOrEqual(
        content.right + 1,
      );
    }
    await expect(triggers.nth(2)).toBeDisabled();
    const truncated = await triggers.nth(1).evaluate((button) => {
      const value = button.querySelector('[data-slot="select-value"]');
      const label = value?.querySelector('[data-slot="label"]');
      if (!value || !label) throw new Error('Missing selected label');
      return {
        labelRight: label.getBoundingClientRect().right,
        valueRight: value.getBoundingClientRect().right,
        width: label.clientWidth,
        scrollWidth: label.scrollWidth,
        overflow: getComputedStyle(label).textOverflow,
      };
    });
    expect(truncated.labelRight).toBeLessThanOrEqual(truncated.valueRight + 1);
    expect(truncated.scrollWidth).toBeGreaterThan(truncated.width);
    expect(truncated.overflow).toBe('ellipsis');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(1);
    await section.screenshot({ path: info.outputPath('field-and-toolbar-select.png') });
  });
}
