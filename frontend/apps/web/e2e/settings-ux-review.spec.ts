import { saveEvidenceScreenshot } from './evidence-screenshot';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { defaultPreferences, PREFERENCES_VERSION } from '@clouddrive/surface/preferences-model';

async function setup(page: Page, pinned = true) {
  await page.addInitScript(
    ({ preferences, version, pinned }) => {
      if (localStorage.getItem('clouddrive.shell')) return;
      localStorage.setItem(
        'clouddrive.shell',
        JSON.stringify({
          version,
          state: {
            preferences: {
              ...preferences,
              navigation: {
                ...preferences.navigation,
                pageTabsEnabled: true,
                pageTabsPinned: pinned,
              },
            },
          },
        }),
      );
    },
    { preferences: defaultPreferences, version: PREFERENCES_VERSION, pinned },
  );
}

async function chooseCategory(page: Page, name: string) {
  const trigger = page.getByRole('button', { name: /切换分类与搜索/ });
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: '设置分类' });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('link', { name, exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
}

for (const width of [1440, 390, 320]) {
  for (const language of ['zh-CN', 'en']) {
    test(`Theme tiles adapt while retaining pointer, keyboard and persistence: ${width}, ${language}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: 'light',
        hasTouch: width < 768,
      });
      const page = await context.newPage();
      if (language === 'en') {
        await page.goto('/settings/locale');
        await page
          .getByRole('radiogroup', { name: '界面语言' })
          .getByText('English', { exact: true })
          .click();
      }
      await page.goto('/settings');
      const group = page.getByRole('radiogroup', {
        name: language === 'en' ? 'Theme mode' : '主题模式',
        exact: true,
      });
      const names: readonly [string, string, string] =
        language === 'en'
          ? ['Light theme', 'Dark theme', 'Follow system']
          : ['浅色主题', '深色主题', '跟随系统'];
      await expect(group.getByRole('radio')).toHaveCount(3);
      await expect(group).toHaveAccessibleDescription(
        language === 'en'
          ? 'Switch to light, dark, or system; preview takes effect immediately.'
          : '切换浅色、深色或跟随系统，立即预览。',
      );
      const boxes = await group
        .locator('label')
        .filter({ has: page.getByRole('radio') })
        .evaluateAll((es) =>
          es.map((e) => {
            const r = e.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          }),
        );
      expect(boxes).toHaveLength(3);
      const firstBox = boxes[0];
      if (!firstBox) throw new Error('Theme tiles missing');
      for (const box of boxes) {
        if (width >= 768) expect(Math.abs(box.y - firstBox.y)).toBeLessThan(1);
        else expect(Math.abs(box.x - firstBox.x)).toBeLessThan(1);
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      if (width < 768) {
        for (let index = 1; index < boxes.length; index++) {
          const previous = boxes[index - 1];
          const current = boxes[index];
          if (!previous || !current) throw new Error('Theme choice missing');
          expect(current.y).toBeGreaterThanOrEqual(previous.y + previous.height);
        }
      }
      const dark = group.getByRole('radio', { name: names[1], exact: true });
      const darkIcon = group
        .locator('label')
        .filter({ has: page.getByRole('radio', { name: names[1], exact: true }) })
        .locator('svg');
      if (width < 768) await darkIcon.tap();
      else await darkIcon.click();
      await expect(dark).toBeChecked();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      await saveEvidenceScreenshot(page, {
        animations: 'disabled',
        path: `docs/changes/109-ui-ux-optimization/evidence/semantic-final/theme-tiles-${width}-${language}-dark.png`,
      });
      await dark.focus();
      await page.keyboard.press('ArrowRight');
      const system = group.getByRole('radio', { name: names[2], exact: true });
      await expect(system).toBeChecked();
      const light = group.getByRole('radio', { name: names[0], exact: true });
      await group
        .locator('label')
        .filter({ has: page.getByRole('radio', { name: names[0], exact: true }) })
        .click({ position: { x: 4, y: 4 } });
      await expect(light).toBeChecked();
      await page.reload();
      await expect(light).toBeChecked();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await group
        .locator('label')
        .filter({ has: page.getByRole('radio', { name: names[2], exact: true }) })
        .click();
      await expect(system).toBeChecked();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await page.getByRole('heading', { level: 1 }).click();
      await saveEvidenceScreenshot(page, {
        animations: 'disabled',
        path: `docs/changes/109-ui-ux-optimization/evidence/semantic-final/theme-tiles-${width}-${language}-system.png`,
      });
      await context.close();
    });
  }
}

test('Choice tiles authority retains disabled state and keyboard focus on the card', async ({
  page,
}) => {
  await page.goto('/ui-elements/forms#element-radiogroupfield');
  const group = page.getByRole('radiogroup', { name: '图标选择卡片', exact: true });
  const disabled = group.getByRole('radio', { name: '自动执行', exact: true });
  await expect(disabled).toBeDisabled();
  const observe = group.getByRole('radio', { name: '仅观察', exact: true });
  await group
    .locator('label')
    .filter({ has: page.getByRole('radio', { name: '仅观察', exact: true }) })
    .locator('svg')
    .click();
  await expect(observe).toBeChecked();
  await observe.focus();
  await page.keyboard.press('ArrowRight');
  const guided = group.getByRole('radio', { name: '引导执行', exact: true });
  await expect(guided).toBeChecked();
  await expect(
    group
      .locator('label')
      .filter({ has: page.getByRole('radio', { name: '引导执行', exact: true }) }),
  ).toHaveAttribute('data-focus-visible', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(observe).toBeChecked();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});

async function expectSwitchGeometry(page: Page) {
  await expect
    .poll(() =>
      page.locator('[data-slot="switch-control"]').evaluateAll((controls) =>
        controls.every((control) => {
          const thumb = control.querySelector('[data-slot="switch-thumb"]');
          if (!thumb) return false;
          const track = control.getBoundingClientRect();
          const circle = thumb.getBoundingClientRect();
          const selected = control.closest('[data-selected="true"]') !== null;
          const rtl = getComputedStyle(control).direction === 'rtl';
          const left = circle.left - track.left;
          const right = track.right - circle.right;
          const endpoint = selected !== rtl ? right : left;
          const top = circle.top - track.top;
          const bottom = track.bottom - circle.bottom;
          return (
            Math.abs(endpoint - top) < 0.5 &&
            Math.abs(top - bottom) < 0.5 &&
            Math.abs(circle.width - circle.height) < 0.5 &&
            endpoint > 0
          );
        }),
      ),
    )
    .toBe(true);
}

test('Switch thumb endpoint inset matches vertical inset in row, card and disabled states', async ({
  page,
}) => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto('/ui-elements/forms#element-switchfield');
      await expect(page.getByRole('switch').first()).toBeVisible();
      await expectSwitchGeometry(page);
      const switches = page.getByRole('switch');
      for (const input of await switches.all()) {
        if (await input.isEnabled()) {
          const before = await input.isChecked();
          await input.focus();
          await page.keyboard.press('Space');
          await expect(input).toBeChecked({ checked: !before });
          await expectSwitchGeometry(page);
        }
      }
      await page.getByRole('heading', { level: 1 }).click();
      await saveEvidenceScreenshot(page, {
        animations: 'disabled',
        path: `docs/changes/109-ui-ux-optimization/evidence/semantic-final/switch-geometry-${width}-${colorScheme}.png`,
      });
    }
  }
});

for (const width of [1440, 390, 320]) {
  for (const density of ['紧凑', '标准', '宽松']) {
    test(`Switch row hover encloses text and control with clickable inset: ${width}, ${density}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/settings');
      await page
        .getByRole('radiogroup', { name: '界面密度', exact: true })
        .getByText(density, { exact: true })
        .click();
      await page.goto('/settings/navigation');
      const input = page.getByRole('switch', { name: '跳转后自动滚动到顶部', exact: true });
      const row = page.locator('label').filter({ has: input });
      await row.hover();
      await expect(row).toHaveAttribute('data-hovered', 'true');
      const surface = await row.boundingBox();
      const text = await row.getByText('跳转后自动滚动到顶部', { exact: true }).boundingBox();
      const control = await row.locator('[data-slot="switch-control"]').boundingBox();
      expect((text?.x ?? 0) - (surface?.x ?? 0)).toBeGreaterThanOrEqual(10);
      expect(
        (surface?.x ?? 0) + (surface?.width ?? 0) - (control?.x ?? 0) - (control?.width ?? 0),
      ).toBeGreaterThanOrEqual(10);
      const before = await input.isChecked();
      await expectSwitchGeometry(page);
      await row.click({ position: { x: 5, y: (surface?.height ?? 44) / 2 } });
      await expect(input).toBeChecked({ checked: !before });
      await expectSwitchGeometry(page);
      await input.focus();
      await page.keyboard.press('Space');
      await expect(input).toBeChecked({ checked: before });
      await page.getByRole('heading', { level: 1, name: '导航', exact: true }).click();
      await row.hover();
      await saveEvidenceScreenshot(page, {
        animations: 'disabled',
        path: `docs/changes/109-ui-ux-optimization/evidence/semantic-final/switch-row-hover-${width}-${density}.png`,
      });
    });
  }
}

test('Sticky consumers resolve actual chrome height across live tabs and viewport changes', async ({
  page,
}) => {
  await setup(page);
  for (const width of [1440, 2560, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/settings/navigation');
    const enabled = page.getByRole('switch', { name: '顶部页面标签', exact: true });
    const pinned = page.getByRole('switch', { name: '固定页面标签', exact: true });
    for (const state of ['pinned', 'unpinned', 'hidden'] as const) {
      if (state === 'pinned') {
        if (!(await enabled.isChecked()))
          await page.locator('label').filter({ has: enabled }).click();
        if (!(await pinned.isChecked()))
          await page.locator('label').filter({ has: pinned }).click();
      } else if (state === 'unpinned') await page.locator('label').filter({ has: pinned }).click();
      else await page.locator('label').filter({ has: enabled }).click();
      await expect
        .poll(() =>
          page.locator('.surface-settings-nav').evaluate((nav) => {
            const style = getComputedStyle(nav);
            const chrome = Number.parseFloat(style.getPropertyValue('--shell-chrome-height'));
            const gap =
              innerWidth >= 1280
                ? Number.parseFloat(
                    getComputedStyle(document.documentElement).getPropertyValue('--spacing'),
                  ) *
                  Number.parseFloat(getComputedStyle(document.documentElement).fontSize) *
                  4
                : 0;
            return Math.abs(Number.parseFloat(style.top) - chrome - gap);
          }),
        )
        .toBeLessThan(1);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
      const nav = await page.locator('.surface-settings-nav').boundingBox();
      const header = await page.getByRole('banner').boundingBox();
      expect(nav?.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0) - 1);
      if (state === 'pinned') {
        const tabs = await page.getByRole('navigation', { name: '页面标签' }).boundingBox();
        expect(nav?.y).toBeGreaterThanOrEqual((tabs?.y ?? 0) + (tabs?.height ?? 0) - 1);
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await saveEvidenceScreenshot(page, {
        path: `docs/changes/109-ui-ux-optimization/evidence/semantic-final/layout-${width}-${state}.png`,
      });
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  }
});

test('Split detail shares the dynamic sticky contract without settings-specific offsets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  await page.goto('/page-archetypes/create-edit');
  const detail = page.locator('.surface-split-detail');
  await expect(detail).toBeVisible();
  await expect
    .poll(() =>
      detail.evaluate((element) => {
        const style = getComputedStyle(element);
        return (
          Number.parseFloat(style.top) -
          Number.parseFloat(style.getPropertyValue('--shell-chrome-height'))
        );
      }),
    )
    .toBe(16);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const tabs = await page.getByRole('navigation', { name: '页面标签' }).boundingBox();
  const bounds = await detail.boundingBox();
  expect(bounds?.y).toBeGreaterThanOrEqual((tabs?.y ?? 0) + (tabs?.height ?? 0));
});

test('Short desktop window retains access to the last settings category', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 500 });
  await setup(page);
  await page.goto('/settings/actions');
  await page.evaluate(() => window.scrollTo(0, 800));
  const nav = page.locator('.surface-settings-nav');
  await expect
    .poll(() => nav.evaluate((element) => element.clientHeight < element.scrollHeight))
    .toBe(true);
  await nav.getByRole('link', { name: '快捷键', exact: true }).focus();
  const target = await nav.getByRole('link', { name: '快捷键', exact: true }).boundingBox();
  expect(target?.y).toBeGreaterThanOrEqual(139);
  expect((target?.y ?? 500) + (target?.height ?? 0)).toBeLessThanOrEqual(500);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/settings/shortcuts');
  await expect(page.getByRole('heading', { name: '快捷键', level: 2, exact: true })).toBeVisible();
  await saveEvidenceScreenshot(page, {
    animations: 'disabled',
    path: 'docs/changes/109-ui-ux-optimization/evidence/semantic-final/layout-short-desktop.png',
  });
});

test('Settings switches share one pointer and keyboard press boundary', async ({ page }) => {
  await page.goto('/settings/navigation');
  const input = page.getByRole('switch', { name: '顶部页面标签', exact: true });
  const label = page.locator('label').filter({ has: input });
  await label.locator('[data-slot="switch-control"]').click();
  await expect(input).toBeChecked();
  await label.getByText('顶部页面标签', { exact: true }).click();
  await expect(input).not.toBeChecked();
  await label.click({ position: { x: 5, y: 5 } });
  await expect(input).toBeChecked();
  await input.focus();
  await page.keyboard.press('Space');
  await expect(input).not.toBeChecked();
  await expect(page.getByRole('switch', { name: '固定页面标签', exact: true })).toBeDisabled();
  await expect(page.getByText('先启用顶部页面标签，即可选择是否固定。')).toBeVisible();
});

test('Radio indicator and card edge select the same option and arrows retain selection', async ({
  page,
}) => {
  await page.goto('/ui-elements/forms#element-radiogroupfield');
  const group = page.getByRole('radiogroup', { name: '反馈密度', exact: true });
  const compact = group.getByRole('radio', { name: '仅观察', exact: true });
  const compactLabel = group
    .locator('label')
    .filter({ has: page.getByRole('radio', { name: '仅观察', exact: true }) });
  await compactLabel.locator('[data-slot="radio-control"]').click();
  await expect(compact).toBeChecked();
  const comfortable = group.getByRole('radio', { name: '引导执行', exact: true });
  const card = group
    .locator('label')
    .filter({ has: page.getByRole('radio', { name: '引导执行', exact: true }) });
  const size = await card.boundingBox();
  expect(size).not.toBeNull();
  await card.click({ position: { x: (size?.width ?? 30) - 5, y: 5 } });
  await expect(comfortable).toBeChecked();
  await comfortable.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(compact).toBeChecked();
});

test('Checkbox indicator works in the shared form authority and disabled option stays disabled', async ({
  page,
}) => {
  await page.goto('/ui-elements/forms');
  const input = page.getByRole('checkbox', { name: '复选项', exact: true });
  const initial = await input.isChecked();
  const label = page.locator('label').filter({ has: input });
  await label.locator('[data-slot="checkbox-control"]').click();
  await expect(input).toBeChecked({ checked: !initial });
  await input.focus();
  await page.keyboard.press('Space');
  await expect(input).toBeChecked({ checked: initial });
  const disabled = page.getByRole('checkbox', { name: '禁用复选项', exact: true });
  await expect(disabled).toBeDisabled();
});

for (const width of [320, 390, 430, 768, 1024, 1279]) {
  test(`Settings category navigation stays reachable through continuous tasks at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await setup(page);
    await page.goto('/settings/actions');
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    await expect(page.locator('.surface-settings-nav')).toBeVisible();
    for (const offset of [650, 1600, 3000]) {
      await page.evaluate((y) => window.scrollTo(0, y), offset);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
      const position = await page.locator('.surface-settings-nav').boundingBox();
      const tabs = await page.getByRole('navigation', { name: '页面标签' }).boundingBox();
      expect(position?.y).toBeGreaterThanOrEqual((tabs?.y ?? 0) + (tabs?.height ?? 0) - 1);
      expect(position?.y).toBeLessThan(210);
    }
    await chooseCategory(page, '通知');
    await page.evaluate(() => window.scrollTo(0, 800));
    await chooseCategory(page, '可访问性');
    await page.getByRole('link', { name: '前往外观分类' }).click();
    await expect(page).toHaveURL('/settings');
    await page.evaluate(() => window.scrollTo(0, 1200));
    await chooseCategory(page, '操作偏好');
    await page.getByRole('button', { name: /切换分类与搜索/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /切换分类与搜索/ })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await saveEvidenceScreenshot(page, {
      path: `docs/changes/109-ui-ux-optimization/evidence/semantic-final/settings-${width}.png`,
    });
  });
}

test('Pinned page tabs track the header; unpinned tabs scroll and persist after reload', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  await page.goto('/settings/navigation');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('switch', { name: '顶部页面标签', exact: true })).toBeChecked();
  const pinned = page.getByRole('switch', { name: '固定页面标签', exact: true });
  await expect(pinned).toBeChecked();
  const tabs = page.getByRole('navigation', { name: '页面标签' });
  await expect(tabs).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 700));
  const pinnedBounds = await tabs.boundingBox();
  expect(pinnedBounds?.y).toBe(80);
  await pinned.focus();
  await page.keyboard.press('Space');
  await expect(pinned).not.toBeChecked();
  await page.evaluate(() => window.scrollTo(0, 900));
  expect((await tabs.boundingBox())?.y).toBeLessThan(0);
  await page.reload();
  await expect(pinned).not.toBeChecked();
});

test('All page tabs stay manageable on desktop and closing active restores useful focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page);
  await page.goto('/settings');
  const nav = page.getByRole('navigation', { name: '设置分类', exact: true });
  for (const name of ['导航', '数据展示', '操作偏好', '语言与地区', '通知', '可访问性', '快捷键']) {
    await nav.getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
  }
  const tabs = page.getByRole('navigation', { name: '页面标签' });
  const active = tabs.locator('[aria-current="page"]');
  const bounds = await active.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 2000) + (bounds?.width ?? 0)).toBeLessThan(1440);
  await tabs.getByRole('button', { name: '关闭 快捷键', exact: true }).click();
  await expect(page).toHaveURL('/settings/accessibility');
  await expect(tabs.locator('[aria-current="page"]')).toBeFocused();
  await tabs.getByRole('button', { name: '页面标签', exact: true }).click();
  await page.getByRole('menuitem', { name: '关闭其他页面标签', exact: true }).click();
  await expect(tabs.getByRole('button', { name: /^关闭 / })).toHaveCount(1);
});

test('Settings drawer and form authority retain WCAG AA semantics in dark English', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: /切换分类与搜索/ }).click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await page
    .getByRole('radiogroup', { name: '主题模式' })
    .getByText('深色主题', { exact: true })
    .click();
  await chooseCategory(page, '语言与地区');
  await page
    .getByRole('radiogroup', { name: '界面语言' })
    .getByText('English', { exact: true })
    .click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await saveEvidenceScreenshot(page, {
    path: 'docs/changes/109-ui-ux-optimization/evidence/semantic-final/settings-dark-en.png',
  });
});

test.describe('Touch settings tasks', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('Touch control and category entry work without hover at different scroll positions', async ({
    page,
  }) => {
    await page.goto('/settings/navigation');
    const input = page.getByRole('switch', { name: '顶部页面标签', exact: true });
    const label = page.locator('label').filter({ has: input });
    await label.locator('[data-slot="switch-control"]').tap();
    await expect(input).toBeChecked();
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.getByRole('button', { name: /切换分类与搜索/ }).tap();
    await page.getByRole('dialog').getByRole('link', { name: '通知', exact: true }).tap();
    await expect(page).toHaveURL('/settings/notifications');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByRole('button', { name: '关闭 通知', exact: true })).toBeVisible();
  });
});

test('Settings keep search context, same-category position, and native Back continuity', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings/actions');
  await page.evaluate(() => window.scrollTo(0, 1100));
  const before = await page.evaluate(() => window.scrollY);
  await page.getByRole('button', { name: /切换分类与搜索/ }).click();
  await page.getByRole('dialog').getByRole('link', { name: '操作偏好', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await chooseCategory(page, '通知');
  await page.goBack();
  await expect(page).toHaveURL('/settings/actions');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
  await page.getByRole('button', { name: /切换分类与搜索/ }).click();
  await page.getByRole('searchbox', { name: '搜索设置项' }).fill('固定');
  await page.getByRole('dialog').getByRole('link', { name: '固定页面标签', exact: true }).click();
  await expect(page).toHaveURL(/#settings-navigation-pageTabsPinned$/);
  await page.getByRole('button', { name: /切换分类与搜索/ }).click();
  await expect(page.getByRole('searchbox', { name: '搜索设置项' })).toHaveValue('固定');
});
