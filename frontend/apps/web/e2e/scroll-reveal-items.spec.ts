import { saveEvidenceScreenshot } from './evidence-screenshot';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const evidence = 'docs/changes/109-ui-ux-optimization/evidence/scroll-items';
async function slowlyScroll(page: Page, to: number) {
  const from = await page.evaluate(() => scrollY);
  for (let y = from; y < to; y += 20) {
    await page.evaluate((top) => scrollTo(0, top), Math.min(y + 20, to));
    await page.waitForTimeout(40);
  }
}

for (const width of [1440, 390]) {
  test(`settings reveal each row independently with no animated Section ancestor at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 500 });
    await page.goto('/settings');
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    const density = page.locator('#settings-appearance-density');
    const font = page.locator('#settings-appearance-fontScale');
    await expect(density).toHaveAttribute('data-reveal', 'pending');
    await expect(font).toHaveAttribute('data-reveal', 'pending');
    const heading = page.getByRole('heading', { name: '空间与阅读', exact: true }).locator('../..');
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const top = (await heading.boundingBox())!.y;
    await slowlyScroll(page, top - 460);
    await expect(heading).toHaveAttribute('data-reveal', 'revealed');
    await expect(density).toHaveAttribute('data-reveal', 'pending');
    await slowlyScroll(
      page,
      (await density.boundingBox())!.y + (await page.evaluate(() => scrollY)) - 460,
    );
    await expect(density).toHaveAttribute('data-reveal-entry', 'true');
    await expect(font).toHaveAttribute('data-reveal', 'pending');
    expect(
      await density.evaluate((e) => {
        const names = [];
        for (let p = e.parentElement; p && p.tagName !== 'MAIN'; p = p.parentElement)
          names.push(getComputedStyle(p).animationName);
        return names;
      }),
    ).toEqual(expect.arrayContaining(['none']));
    expect(
      await density.evaluate((e) => {
        for (let p = e.parentElement; p && p.tagName !== 'MAIN'; p = p.parentElement)
          if (getComputedStyle(p).animationName !== 'none') return true;
        return false;
      }),
    ).toBe(false);
    // 末尾字段（灰阶）在窄屏会落在设置页脚之上：直接滚到该行，仍验证"最后一行进入视口才揭示"。
    const lastRow = page.locator('#settings-appearance-grayscale');
    await lastRow.scrollIntoViewIfNeeded();
    await expect(lastRow).toHaveAttribute('data-reveal', 'revealed');
    await page.waitForTimeout(350);
    await page.evaluate(() => scrollTo(0, 0));
    await density.scrollIntoViewIfNeeded();
    expect(await density.evaluate((e) => e.getAnimations().length)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await mkdir(evidence, { recursive: true });
    await page.getByRole('heading', { level: 1 }).click();
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await saveEvidenceScreenshot(page, {
      path: `${evidence}/settings-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  });
}

test('first viewport items have bounded stagger and offscreen items wait for scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  const rows = page.locator('[id^=settings-appearance][data-reveal="revealed"]');
  await expect(page.locator('#settings-appearance-density')).toHaveAttribute(
    'data-reveal',
    'revealed',
  );
  expect(await rows.count()).toBeGreaterThan(1);
  const sample = await rows.evaluateAll((items) =>
    items.map((e) => ({
      order: Number(e.getAttribute('data-reveal-order')),
      delay: parseFloat(getComputedStyle(e).animationDelay),
    })),
  );
  expect(sample.every((item) => item.delay <= 0.12)).toBe(true);
  expect(new Set(sample.map((item) => item.delay)).size).toBe(sample.length);
  expect(sample.some((item) => item.delay > 0)).toBe(true);
  await expect(page.locator('#settings-appearance-contrast')).toHaveAttribute(
    'data-reveal',
    'pending',
  );
});

test('all primary routes use independent semantic reveal units and retain layout', async ({
  page,
}) => {
  test.setTimeout(120_000); // Multi-route audit; each route still uses normal locator timeouts.
  const routes = [
    '/',
    '/foundations',
    '/motion',
    '/states',
    '/system-tools/icons',
    '/reference-resources',
    '/reference-resources/create',
    '/reference-resources/detail?id=resource-alpha',
    '/reference-resources/edit?id=resource-alpha',
    ...[
      '',
      'navigation',
      'data-display',
      'locale',
      'notifications',
      'accessibility',
      'shortcuts',
      'actions',
    ].map((p) => `/settings${p ? '/' + p : ''}`),
    ...[
      'actions-selection',
      'feedback',
      'status-async',
      'identity-display',
      'navigation',
      'data',
      'surfaces',
      'forms',
      'overlays',
    ].map((p) => `/ui-elements/${p}`),
    ...[
      'layout-navigation',
      'collections-data',
      'forms-actions',
      'detail-settings',
      'states-feedback',
    ].map((p) => `/page-patterns/${p}`),
    ...[
      'overview',
      'resource-list',
      'create-edit',
      'detail',
      'settings',
      'master-detail',
      'operation',
    ].map((p) => `/page-archetypes/${p}`),
  ];
  const results = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
    await expect(page.locator('main h1')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (route === '/ui-elements/forms')
      await expect(page.getByRole('group', { name: 'DatePicker', exact: true })).toBeVisible();
    const before = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(350);
    const sample = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
      units: document.querySelectorAll('main [data-reveal]').length,
      nested: Array.from(document.querySelectorAll('main [data-reveal]')).some((e) =>
        Boolean(e.parentElement?.closest('[data-reveal]')),
      ),
      hidden: Array.from(document.querySelectorAll('main [data-reveal="revealed"]')).some(
        (e) => getComputedStyle(e).opacity === '0',
      ),
    }));
    expect(sample.height, route).toBe(before);
    expect(sample.overflow, route).toBe(false);
    expect(sample.hidden, route).toBe(false);
    expect(sample.nested, route).toBe(false);
    expect(sample.units, route).toBeGreaterThan(0);
    results.push({ route, ...sample });
  }
  expect(errors).toEqual([]);
  await mkdir(evidence, { recursive: true });
  await writeFile(`${evidence}/route-audit.json`, JSON.stringify(results, null, 2) + '\n');
});
