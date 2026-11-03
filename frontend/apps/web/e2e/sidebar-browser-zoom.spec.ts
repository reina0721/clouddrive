import { saveEvidenceScreenshot } from './evidence-screenshot';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect, test as base } from '@playwright/test';

// Remove the Desktop Chrome fixture's DPR emulation for this native-window test.
const test = base.extend({
  deviceScaleFactor: async ({ browserName }, provide) => {
    expect(browserName).toBe('chromium');
    await provide(undefined);
  },
});

for (const factor of [1.25, 2]) {
  test(`Native Chromium page zoom ${factor * 100}% preserves navigation access`, async ({
    context,
    baseURL,
  }, testInfo) => {
    const profile = testInfo.outputPath('isolated-zoom-profile');
    if (!path.resolve(profile).startsWith(path.resolve(testInfo.outputDir) + path.sep)) {
      throw new Error('Zoom profile must stay inside this test output directory');
    }
    await mkdir(path.join(profile, 'Default'), { recursive: true });
    // Chromium's empty storage partition uses "x". This is browser page zoom,
    // not CSS zoom, font scaling, viewport emulation or device scale emulation.
    await writeFile(
      path.join(profile, 'Default', 'Preferences'),
      JSON.stringify({
        partition: { default_zoom_level: { x: Math.log(factor) / Math.log(1.2) } },
      }),
    );
    const state = await context.storageState();
    const zoomed = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      viewport: null,
      args: ['--window-size=1920,1080', '--force-device-scale-factor=1'],
    });
    try {
      await zoomed.addInitScript((origins) => {
        const saved = origins.find((entry) => entry.origin === location.origin);
        for (const item of saved?.localStorage ?? []) localStorage.setItem(item.name, item.value);
      }, state.origins);
      const page = await zoomed.newPage();
      await page.goto(`${baseURL}/ui-elements/navigation`);
      await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
      const metrics = await page.evaluate(() => ({
        ratio: devicePixelRatio,
        innerWidth,
        outerWidth,
        fontSize: getComputedStyle(document.documentElement).fontSize,
        cssZoom: getComputedStyle(document.documentElement).zoom,
        visualViewportScale: visualViewport?.scale,
      }));
      expect(metrics.ratio).toBeCloseTo(factor, 2);
      // Native window decorations occupy physical pixels outside the content.
      expect(metrics.innerWidth * factor).toBeLessThanOrEqual(metrics.outerWidth);
      expect(metrics.innerWidth * factor).toBeGreaterThan(metrics.outerWidth - 32);
      expect(metrics.cssZoom).toBe('1');
      expect(metrics.visualViewportScale).toBe(1);
      await writeFile(
        testInfo.outputPath(`native-zoom-${factor * 100}.json`),
        JSON.stringify(metrics, null, 2) + '\n',
      );
      if (factor === 1.25) {
        await page.getByRole('button', { name: '收起侧栏' }).click();
        const nav = page.getByRole('navigation', { name: '主导航' });
        await expect(page.locator('aside').first()).toHaveCSS('width', '80px');
        const branch = nav.getByRole('button', { name: 'UI Elements', exact: true });
        expect((await branch.boundingBox())?.width).toBe(48);
        await expect(branch.locator('svg').first()).toHaveCSS('width', '24px');
        await branch.click();
        await expect(
          page
            .getByRole('dialog', { name: 'UI Elements', exact: true })
            .getByRole('link', { name: '导航', exact: true }),
        ).toBeVisible();
      } else {
        await page.getByRole('button', { name: '打开导航' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
        await saveEvidenceScreenshot(page, {
          path: testInfo.outputPath('native-zoom-200-drawer.png'),
          animations: 'disabled',
        });
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden();
        await expect(page.getByRole('button', { name: '打开导航' })).toBeFocused();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await saveEvidenceScreenshot(page, {
        path: testInfo.outputPath(`native-zoom-${factor * 100}.png`),
        animations: 'disabled',
      });
      await testInfo.attach('native-browser-zoom', {
        body: JSON.stringify(metrics, null, 2),
        contentType: 'application/json',
      });
    } finally {
      await zoomed.close();
      await rm(profile, { recursive: true, force: true });
    }
  });
}
