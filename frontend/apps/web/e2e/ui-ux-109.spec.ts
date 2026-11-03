import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { generatedRouteCatalog } from '@clouddrive/surface/generated/catalog';
import { defaultPreferences, PREFERENCES_VERSION } from '@clouddrive/surface/preferences-model';

test('Shell keeps the main content in its viewport at breakpoint boundaries', async ({ page }) => {
  for (const width of [
    320, 390, 430, 639, 640, 767, 768, 1023, 1024, 1025, 1279, 1280, 1281, 1440, 1920, 2560,
  ]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    const geometry = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      top: document.querySelector('main')?.getBoundingClientRect().top ?? Infinity,
    }));
    expect(geometry.width, `width ${width}`).toBeLessThanOrEqual(width);
    expect(geometry.top, `content top at ${width}`).toBeLessThan(200);
  }
});

test('Mobile navigation traps focus, closes with Escape and releases on desktop resize', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: '打开导航', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: '主导航' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '主导航' })).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.setViewportSize({ width: 1024, height: 844 });
  await expect(page.getByRole('dialog', { name: '主导航' })).not.toBeVisible();
});

test('Settings search hands focus to the requested field after closing its drawer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings');
  await page.getByRole('button', { name: /切换分类/ }).click();
  await page.getByRole('searchbox').fill('字号');
  await page.getByRole('link', { name: /界面字号/ }).click();
  await expect(page).toHaveURL(/#settings-appearance-fontScale$/);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const field = page.locator('#settings-appearance-fontScale');
  await expect
    .poll(() => field.evaluate((element) => element.contains(document.activeElement)))
    .toBe(true);
  const bounds = await field.boundingBox();
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  expect((bounds?.y ?? Infinity) + (bounds?.height ?? 0)).toBeLessThanOrEqual(844);
});

test('Reference identity, validation and local saves stay consistent', async ({ page }) => {
  await page.goto('/reference-resources');
  await page.getByRole('link', { name: '查看', exact: true }).nth(1).click();
  await expect(page).toHaveURL(/id=resource-beta$/);
  await expect(page.getByRole('heading', { name: 'Beta 引导指南' })).toBeVisible();
  await page.getByRole('link', { name: '编辑此资源' }).click();
  await page.getByRole('textbox', { name: '名称' }).fill('');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('请输入 1–80 个字符的资源名称。')).toBeVisible();
  await page.getByRole('textbox', { name: '名称' }).fill('Beta 已更新');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.getByRole('link', { name: '返回详情' }).click();
  await expect(page.getByRole('heading', { name: 'Beta 已更新' })).toBeVisible();
  await expect(page.getByRole('alertdialog')).not.toBeVisible();
  await page.goto('/reference-resources/detail?id=missing');
  await expect(page.getByText('未找到此资源', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Alpha 示例资源' })).not.toBeVisible();
});

test('Routes retain titles and main content on mobile and desktop', async ({ page }) => {
  // Integration adds native management routes; preserve the same per-route time allowance.
  test.setTimeout(Math.max(180_000, generatedRouteCatalog.routes.length * 2 * 3_000));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of generatedRouteCatalog.routes) {
      const href =
        route.pattern +
        (['reference-resources.edit', 'reference-resources.detail'].includes(route.routeId)
          ? '?id=resource-alpha'
          : '');
      await page.goto(href);
      await expect(page.locator('main h1').first(), `${width}: ${href}`).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        `${width}: ${href}`,
      ).toBeLessThanOrEqual(width);
    }
  }
});

test('Critical mobile paths meet WCAG AA automated checks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const href of [
    '/settings',
    '/reference-resources/create',
    '/reference-resources/detail?id=resource-beta',
  ]) {
    await page.goto(href);
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations, href).toEqual([]);
  }
});

test('Short dialogs keep actions reachable at 256 and 400 pixels', async ({ page }) => {
  for (const height of [256, 400]) {
    await page.setViewportSize({ width: 390, height });
    for (const overlay of ['dialog', 'confirm']) {
      await page.goto('/ui-elements/overlays?overlay=' + overlay);
      const dialog = page.getByRole(overlay === 'dialog' ? 'dialog' : 'alertdialog');
      await expect(dialog).toBeVisible();
      const cancel = dialog.getByRole('button', { name: '取消', exact: true });
      await cancel.scrollIntoViewIfNeeded();
      const box = await cancel.boundingBox();
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.y ?? Infinity) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
      await cancel.click();
      await expect(dialog).not.toBeVisible();
    }
  }
});

test('Column resizing preserves pointer and keyboard widths through reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/page-archetypes/resource-list');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const handle = page.locator('[data-slot="table-column-resizer"]').first();
  await handle.scrollIntoViewIfNeeded();
  const range = handle.locator('input');
  await expect
    .poll(async () => {
      await range.focus();
      return range.evaluate((element) => document.activeElement === element);
    })
    .toBe(true);
  const before = Number(await range.inputValue());
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect.poll(async () => Number(await range.inputValue())).toBeGreaterThan(before);
  const box = await handle.boundingBox();
  if (!box) throw new Error('Missing resizer hit area');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  const width = Number(await range.inputValue());
  expect(width).toBeGreaterThan(before + 20);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect
    .poll(async () =>
      Number(await page.locator('[data-slot="table-column-resizer"] input').first().inputValue()),
    )
    .toBe(width);
});

test('Closing the active page tab can be cancelled without losing inputs', async ({ page }) => {
  await page.goto('/settings/navigation');
  await page.getByRole('switch', { name: '顶部页面标签', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('navigation', { name: '页面标签' })).toBeVisible();
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '参考资源', exact: true })
    .click();
  await page.getByRole('link', { name: '查看', exact: true }).nth(1).click();
  await page.getByRole('link', { name: '编辑此资源' }).click();
  await page.getByRole('textbox', { name: '名称' }).fill('尚未保存的 Beta');
  const strip = page.getByRole('navigation', { name: '页面标签' });
  await strip.getByRole('button', { name: '关闭 编辑参考资源', exact: true }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page).toHaveURL(/edit\?id=resource-beta$/);
  await expect(page.getByRole('textbox', { name: '名称' })).toHaveValue('尚未保存的 Beta');
  await expect(strip.getByRole('button', { name: '关闭 编辑参考资源', exact: true })).toBeVisible();
  await strip.getByRole('button', { name: '关闭 编辑参考资源', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: '离开', exact: true }).click();
  await expect(page).toHaveURL(/detail\?id=resource-beta$/);
  await expect(page.getByRole('heading', { name: 'Beta 引导指南' })).toBeVisible();
});

test('Operation example closes failure, retry and cancellation loops', async ({ page }) => {
  await page.goto('/page-archetypes/operation');
  const failure = page.getByRole('switch', { name: /^模拟失败/ });
  await failure.focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: '运行', exact: true }).click();
  await expect(page.getByText('报告生成失败', { exact: true })).toBeVisible();
  await failure.focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByText('报告已生成', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '运行', exact: true }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByText('已取消生成', { exact: true })).toBeVisible();
  await page.waitForTimeout(1800);
  await expect(page.getByText('已取消生成', { exact: true })).toBeVisible();
});

test('Detail example validates, saves and resets its real local fields', async ({ page }) => {
  await page.goto('/page-archetypes/detail');
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const name = page.getByRole('textbox').first();
  await name.fill('');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByText('请输入名称').first()).toBeVisible();
  await name.fill('REF-109');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'REF-109', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await name.fill('未保存');
  await page.getByRole('button', { name: '恢复已保存值', exact: true }).click();
  await expect(name).toHaveValue('REF-109');
  await expect(page.getByRole('button', { name: '保存修改', exact: true })).toBeDisabled();
});

test('Mobile showcase index focuses the actual component heading', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ui-elements/forms');
  const index = page.getByRole('navigation', { name: '本页区段' });
  const last = index.getByRole('link').last();
  const label = await last.innerText();
  await last.click();
  const heading = page.getByRole('heading', { name: label, exact: true }).last();
  await expect(heading).toBeFocused();
  const box = await heading.boundingBox();
  expect(box?.y).toBeGreaterThanOrEqual(0);
  expect(box?.y).toBeLessThan(844);
});

for (const density of ['compact', 'standard', 'comfortable'] as const) {
  test(`Public families keep their boundaries in dark English large text: ${density}`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const preferences = {
      ...defaultPreferences,
      appearance: {
        ...defaultPreferences.appearance,
        density,
        themeMode: 'dark',
        fontScale: 'large',
      },
      localeRegion: { ...defaultPreferences.localeRegion, language: 'en' },
    };
    await page.addInitScript(
      ({ preferences, version }) => {
        localStorage.setItem(
          'clouddrive.shell',
          JSON.stringify({ state: { preferences }, version }),
        );
      },
      { preferences, version: PREFERENCES_VERSION },
    );
    await page.setViewportSize({ width: 320, height: 844 });
    for (const family of [
      'actions-selection',
      'feedback',
      'status-async',
      'identity-display',
      'navigation',
      'data',
      'surfaces',
      'forms',
      'overlays',
    ]) {
      await page.goto('/ui-elements/' + family);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('main h1')).toBeVisible();
      const longText = page.getByRole('switch', { name: /^Expanded text/ }).first();
      await longText.focus();
      await page.keyboard.press('Space');
      await expect(longText).toBeChecked();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        family,
      ).toBeLessThanOrEqual(320);
      if (family === 'actions-selection') {
        const group = page.getByRole('radiogroup').first();
        await group.locator('[role="radio"]:enabled:not([aria-disabled="true"])').last().click();
        await expect
          .poll(() =>
            group.evaluate((element) => {
              const selected = element.querySelector('[aria-checked="true"]');
              if (!selected) return false;
              const item = selected.getBoundingClientRect();
              const list = element.getBoundingClientRect();
              return item.left >= list.left - 1 && item.right <= list.right + 1;
            }),
          )
          .toBe(true);
      }
      const search = page.getByRole('searchbox');
      for (const field of await search.all()) {
        const geometry = await field.evaluate((element) => {
          const own = element.getBoundingClientRect();
          const parent = element.parentElement?.getBoundingClientRect();
          return { own: own.width, parent: parent?.width ?? 0 };
        });
        expect(geometry.own, family).toBeLessThanOrEqual(geometry.parent + 1);
      }
    }
  });
}

test('Corrupt current column layout is reported and can be retried', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'clouddrive.page-archetypes.column-layout',
      JSON.stringify({
        state: {
          layouts: {
            'page-archetypes.resource-list': {
              visibleOrder: ['workstream'],
              widths: { workstream: -2 },
            },
          },
        },
        version: 2,
      }),
    );
  });
  await page.goto('/page-archetypes/resource-list');
  await expect(page.getByText('未能恢复列布局', { exact: true })).toBeVisible();
  await expect(page.getByRole('grid').getByRole('rowheader').first()).toBeVisible();
  await page.evaluate(() => localStorage.removeItem('clouddrive.page-archetypes.column-layout'));
  await page.getByLabel('未能恢复列布局', { exact: true }).getByRole('button').click();
  await expect(page.getByText('未能恢复列布局', { exact: true })).not.toBeVisible();
});

test('Saving a restored draft clears its dirty baseline before continuing creation', async ({
  page,
}) => {
  const preferences = {
    ...defaultPreferences,
    actionPreferences: {
      ...defaultPreferences.actionPreferences,
      autosaveDrafts: true,
      createSuccessDestination: 'continue',
    },
  };
  await page.addInitScript(
    ({ preferences, version }) => {
      localStorage.setItem('clouddrive.shell', JSON.stringify({ state: { preferences }, version }));
    },
    { preferences, version: PREFERENCES_VERSION },
  );
  await page.goto('/reference-resources/create');
  const name = page.getByRole('textbox', { name: '名称' });
  await name.fill('恢复后提交的草稿');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('clouddrive.workspace')))
    .toContain('恢复后提交的草稿');
  await page.reload();
  await expect(name).toHaveValue('恢复后提交的草稿');
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await expect(name).toHaveValue('');
  await name.fill('临时内容');
  await name.fill('');
  await page.getByRole('link', { name: '返回列表', exact: true }).click();
  await expect(page).toHaveURL(/\/reference-resources$/);
  await expect(page.getByRole('alertdialog')).not.toBeVisible();
});

test('Native repeated submits create one resource and allow retry after validation', async ({
  page,
}) => {
  await page.goto('/reference-resources/create');
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await expect(page.getByText('请输入 1–80 个字符的资源名称。', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '名称', exact: true }).fill('并发提交回归109');
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!form) throw new Error('Missing resource form');
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page).toHaveURL(/\/reference-resources$/);
  await expect(page.getByText('并发提交回归109', { exact: true })).toHaveCount(1);
});

test('Leaving during validation prevents a stale save and redirect', async ({ page }) => {
  let release: () => void = () => undefined;
  let held = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Hold the actual validation module in the configured Next development host.
  await page.route('**/surfaces_plugins_reference-resources_src_schema_ts_*.js', async (route) => {
    held = true;
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/reference-resources/create');
    await page.getByRole('textbox', { name: '名称', exact: true }).fill('过期提交回归109');
    await page.getByRole('button', { name: '创建', exact: true }).click();
    await expect.poll(() => held).toBe(true);
    await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true');
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '工作台', exact: true })
      .click();
    await expect(page).toHaveURL('/');
    release();
    await page.waitForTimeout(600);
    await expect(page).toHaveURL('/');
    await page
      .getByRole('navigation', { name: '主导航' })
      .getByRole('link', { name: '参考资源', exact: true })
      .click();
    await expect(page.getByText('过期提交回归109', { exact: true })).toHaveCount(0);
  } finally {
    release();
  }
});

test('Leaving the local form simulation cancels its pending feedback', async ({ page }) => {
  await page.goto('/page-archetypes/create-edit');
  await expect(page.locator('form')).toBeVisible();
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!form) throw new Error('Missing reference form');
    form.requestSubmit();
  });
  await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true');
  await page
    .getByRole('navigation', { name: '主导航' })
    .getByRole('link', { name: '工作台', exact: true })
    .click();
  await expect(page).toHaveURL('/');
  await page.waitForTimeout(700);
  await expect(
    page.getByRole('alertdialog', { name: '草稿已保存', exact: true }),
  ).not.toBeVisible();
});
