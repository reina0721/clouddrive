# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: motion-progressive.spec.ts >> progressive settings remains usable through long, fast and reverse scrolling at 1440
- Location: apps\web\e2e\motion-progressive.spec.ts:41:3

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 10
Received:   0
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
    - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
    - alert [ref=e11]
    - main "正在加载应用" [ref=e12]:
        - generic [ref=e13]:
            - status [ref=e14]:
                - status "正在加载应用" [ref=e15]:
                    - status
                - generic [ref=e16]: 正在加载应用
            - status "正在加载应用" [ref=e17]
```

# Test source

```ts
  1   | import AxeBuilder from '@axe-core/playwright';
  2   | import { expect, test } from '@playwright/test';
  3   | import { mkdir } from 'node:fs/promises';
  4   | import { defaultPreferences, PREFERENCES_VERSION } from '@clouddrive/surface/preferences-model';
  5   |
  6   | const evidence = 'docs/changes/109-ui-ux-optimization/evidence/scroll-items';
  7   |
  8   | test('settings keeps its shell stable and enters semantic regions inside the nested Page', async ({
  9   |   page,
  10  | }) => {
  11  |   await page.goto('/settings');
  12  |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  13  |   await page
  14  |     .getByRole('navigation', { name: '主导航' })
  15  |     .getByRole('link', { name: '总览', exact: true })
  16  |     .click();
  17  |   await expect(page).toHaveURL('/');
  18  |   await page
  19  |     .getByRole('navigation', { name: '主导航' })
  20  |     .getByRole('link', { name: '设置', exact: true })
  21  |     .click();
  22  |   await expect(page).toHaveURL('/settings');
  23  |   const stack = page.locator('[data-route-content] > .surface-page-stack');
  24  |   await expect.poll(() => stack.evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
  25  |   await expect
  26  |     .poll(() =>
  27  |       stack
  28  |         .locator('[id^=settings-][data-reveal]')
  29  |         .first()
  30  |         .evaluate((e) => getComputedStyle(e).animationName),
  31  |     )
  32  |     .toContain('surface-item-enter');
  33  |   await expect
  34  |     .poll(() =>
  35  |       page.locator('main h1').evaluate((e) => getComputedStyle(e.closest('header')!).animationName),
  36  |     )
  37  |     .not.toContain('surface-enter-forward');
  38  | });
  39  |
  40  | for (const width of [1440, 390, 320]) {
  41  |   test(`progressive settings remains usable through long, fast and reverse scrolling at ${width}`, async ({
  42  |     page,
  43  |   }) => {
  44  |     await page.setViewportSize({ width, height: 360 });
  45  |     await page.addInitScript(() => {
  46  |       const Original = window.IntersectionObserver;
  47  |       let active = 0;
  48  |       let peak = 0;
  49  |       window.IntersectionObserver = class extends Original {
  50  |         private counted = false;
  51  |         constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
  52  |           super(callback, options);
  53  |           if (options?.rootMargin === '0px' && options.threshold === 0) {
  54  |             this.counted = true;
  55  |             peak = Math.max(peak, ++active);
  56  |             document.documentElement.dataset.testObserverPeak = String(peak);
  57  |           }
  58  |         }
  59  |         override disconnect() {
  60  |           super.disconnect();
  61  |           if (this.counted) {
  62  |             --active;
  63  |             this.counted = false;
  64  |           }
  65  |         }
  66  |       };
  67  |     });
  68  |     await page.goto('/settings/actions');
  69  |     await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  70  |     const regions = page.locator('[id^=settings-][data-reveal]');
> 71  |     expect(await regions.count()).toBeGreaterThan(10);
      |                                   ^ Error: expect(received).toBeGreaterThan(expected)
  72  |     await expect(regions.last()).toHaveAttribute('data-reveal', 'pending');
  73  |     await expect(regions.first()).toHaveCSS('opacity', '1');
  74  |     const height = await page.evaluate(() => document.documentElement.scrollHeight);
  75  |     const regionHeight = (await regions.first().boundingBox())!.height;
  76  |     expect(regionHeight).toBeGreaterThan(0);
  77  |     await regions.first().scrollIntoViewIfNeeded();
  78  |     await expect(regions.first()).toHaveAttribute('data-reveal', 'revealed');
  79  |     await expect
  80  |       .poll(() =>
  81  |         regions.first().evaluate((e) => e.getAnimations().some((a) => a.playState === 'running')),
  82  |       )
  83  |       .toBe(false);
  84  |     await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  85  |     await expect(regions.last()).toHaveAttribute('data-reveal', 'revealed');
  86  |     await page.evaluate(() => window.scrollTo(0, 0));
  87  |     await regions.first().scrollIntoViewIfNeeded();
  88  |     await expect
  89  |       .poll(() =>
  90  |         regions.first().evaluate((e) => e.getAnimations().some((a) => a.playState === 'running')),
  91  |       )
  92  |       .toBe(false);
  93  |     expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
  94  |     expect(Number(await page.locator('html').getAttribute('data-test-observer-peak'))).toBe(1);
  95  |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
  96  |       true,
  97  |     );
  98  |     expect(
  99  |       (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
  100 |         .violations,
  101 |     ).toEqual([]);
  102 |     await mkdir(evidence, { recursive: true });
  103 |     await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  104 |     await page.screenshot({
  105 |       animations: 'disabled',
  106 |       path: `${evidence}/settings-actions-${width}.png`,
  107 |       fullPage: true,
  108 |     });
  109 |   });
  110 | }
  111 |
  112 | for (const mode of ['missing', 'silent', 'reduced'] as const) {
  113 |   test(`content is immediately available with ${mode} motion observation`, async ({ page }) => {
  114 |     if (mode === 'reduced') await page.emulateMedia({ reducedMotion: 'reduce' });
  115 |     else
  116 |       await page.addInitScript((variant) => {
  117 |         Object.defineProperty(window, 'IntersectionObserver', {
  118 |           configurable: true,
  119 |           value:
  120 |             variant === 'missing'
  121 |               ? undefined
  122 |               : class {
  123 |                   observe() {}
  124 |                   unobserve() {}
  125 |                   disconnect() {}
  126 |                 },
  127 |         });
  128 |       }, mode);
  129 |     await page.goto('/settings/actions');
  130 |     await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  131 |     const region = page.locator('#settings-actionPreferences-showSearchSuggestions');
  132 |     await expect(region).toHaveCSS('opacity', '1');
  133 |     await expect(region).toHaveCSS('transform', 'none');
  134 |     await region.getByRole('switch', { name: '显示搜索建议', exact: true }).focus();
  135 |     await expect(region).toHaveAttribute('data-reveal', 'revealed');
  136 |     await expect(region).toHaveAttribute('data-reveal-entry', 'false');
  137 |     await region.getByRole('switch', { name: '显示搜索建议', exact: true }).press('Space');
  138 |     await expect(
  139 |       region.getByRole('switch', { name: '显示搜索建议', exact: true }),
  140 |     ).not.toBeChecked();
  141 |     await page.reload();
  142 |     await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  143 |     await expect(page.getByRole('switch', { name: '显示搜索建议', exact: true })).not.toBeChecked();
  144 |   });
  145 | }
  146 |
  147 | test('anchor refresh and browser return never leave reading content hidden', async ({ page }) => {
  148 |   await page.goto('/settings/actions#settings-actionPreferences-showSearchSuggestions');
  149 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  150 |   const region = page.locator('#settings-actionPreferences-showSearchSuggestions');
  151 |   const target = page.locator('#settings-actionPreferences-showSearchSuggestions');
  152 |   await expect(target).toBeInViewport();
  153 |   await expect(target.getByRole('switch')).toBeFocused();
  154 |   await page.reload();
  155 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  156 |   await expect(target).toBeInViewport();
  157 |   await expect(target.getByRole('switch')).toBeFocused();
  158 |   await expect(region).toHaveCSS('opacity', '1');
  159 |   await page
  160 |     .getByRole('navigation', { name: '主导航' })
  161 |     .getByRole('link', { name: '总览', exact: true })
  162 |     .click();
  163 |   await expect(page).toHaveURL('/');
  164 |   await page.goBack();
  165 |   await expect(page).toHaveURL(/settings\/actions/);
  166 |   await expect(region).toHaveCSS('opacity', '1');
  167 | });
  168 |
  169 | test('master detail swaps locally while preserving selection focus', async ({ page }) => {
  170 |   await page.goto('/page-archetypes/master-detail');
  171 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
```
