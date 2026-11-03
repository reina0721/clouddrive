# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scroll-reveal-items.spec.ts >> first viewport items have bounded stagger and offscreen items wait for scrolling
- Location: apps\web\e2e\scroll-reveal-items.spec.ts:77:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 1
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
  2   | import { expect, test, type Page } from '@playwright/test';
  3   | import { mkdir, writeFile } from 'node:fs/promises';
  4   |
  5   | const evidence = 'docs/changes/109-ui-ux-optimization/evidence/scroll-items';
  6   | async function slowlyScroll(page: Page, to: number) {
  7   |   const from = await page.evaluate(() => scrollY);
  8   |   for (let y = from; y < to; y += 20) {
  9   |     await page.evaluate((top) => scrollTo(0, top), Math.min(y + 20, to));
  10  |     await page.waitForTimeout(40);
  11  |   }
  12  | }
  13  |
  14  | for (const width of [1440, 390]) {
  15  |   test(`settings reveal each row independently with no animated Section ancestor at ${width}`, async ({
  16  |     page,
  17  |   }) => {
  18  |     await page.setViewportSize({ width, height: 500 });
  19  |     await page.goto('/settings');
  20  |     await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  21  |     const density = page.locator('#settings-appearance-density');
  22  |     const font = page.locator('#settings-appearance-fontScale');
  23  |     await expect(density).toHaveAttribute('data-reveal', 'pending');
  24  |     await expect(font).toHaveAttribute('data-reveal', 'pending');
  25  |     const heading = page.getByRole('heading', { name: '空间与阅读', exact: true }).locator('../..');
  26  |     const height = await page.evaluate(() => document.documentElement.scrollHeight);
  27  |     const top = (await heading.boundingBox())!.y;
  28  |     await slowlyScroll(page, top - 460);
  29  |     await expect(heading).toHaveAttribute('data-reveal', 'revealed');
  30  |     await expect(density).toHaveAttribute('data-reveal', 'pending');
  31  |     await slowlyScroll(
  32  |       page,
  33  |       (await density.boundingBox())!.y + (await page.evaluate(() => scrollY)) - 460,
  34  |     );
  35  |     await expect(density).toHaveAttribute('data-reveal-entry', 'true');
  36  |     await expect(font).toHaveAttribute('data-reveal', 'pending');
  37  |     expect(
  38  |       await density.evaluate((e) => {
  39  |         const names = [];
  40  |         for (let p = e.parentElement; p && p.tagName !== 'MAIN'; p = p.parentElement)
  41  |           names.push(getComputedStyle(p).animationName);
  42  |         return names;
  43  |       }),
  44  |     ).toEqual(expect.arrayContaining(['none']));
  45  |     expect(
  46  |       await density.evaluate((e) => {
  47  |         for (let p = e.parentElement; p && p.tagName !== 'MAIN'; p = p.parentElement)
  48  |           if (getComputedStyle(p).animationName !== 'none') return true;
  49  |         return false;
  50  |       }),
  51  |     ).toBe(false);
  52  |     await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  53  |     await expect(page.locator('#settings-appearance-contrast')).toHaveAttribute(
  54  |       'data-reveal',
  55  |       'revealed',
  56  |     );
  57  |     await page.waitForTimeout(350);
  58  |     await page.evaluate(() => scrollTo(0, 0));
  59  |     await density.scrollIntoViewIfNeeded();
  60  |     expect(await density.evaluate((e) => e.getAnimations().length)).toBe(0);
  61  |     expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
  62  |     expect(
  63  |       (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
  64  |         .violations,
  65  |     ).toEqual([]);
  66  |     await mkdir(evidence, { recursive: true });
  67  |     await page.getByRole('heading', { level: 1 }).click();
  68  |     await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  69  |     await page.screenshot({
  70  |       path: `${evidence}/settings-${width}.png`,
  71  |       fullPage: true,
  72  |       animations: 'disabled',
  73  |     });
  74  |   });
  75  | }
  76  |
  77  | test('first viewport items have bounded stagger and offscreen items wait for scrolling', async ({
  78  |   page,
  79  | }) => {
  80  |   await page.setViewportSize({ width: 1440, height: 900 });
  81  |   await page.goto('/settings');
  82  |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  83  |   const rows = page.locator('[id^=settings-appearance][data-reveal="revealed"]');
> 84  |   expect(await rows.count()).toBeGreaterThan(1);
      |                              ^ Error: expect(received).toBeGreaterThan(expected)
  85  |   const sample = await rows.evaluateAll((items) =>
  86  |     items.map((e) => ({
  87  |       order: Number(e.getAttribute('data-reveal-order')),
  88  |       delay: parseFloat(getComputedStyle(e).animationDelay),
  89  |     })),
  90  |   );
  91  |   expect(sample.every((item) => item.delay <= 0.12)).toBe(true);
  92  |   expect(new Set(sample.map((item) => item.delay)).size).toBe(sample.length);
  93  |   expect(sample.some((item) => item.delay > 0)).toBe(true);
  94  |   await expect(page.locator('#settings-appearance-contrast')).toHaveAttribute(
  95  |     'data-reveal',
  96  |     'pending',
  97  |   );
  98  | });
  99  |
  100 | test('all primary routes use independent semantic reveal units and retain layout', async ({
  101 |   page,
  102 | }) => {
  103 |   test.setTimeout(120_000); // Multi-route audit; each route still uses normal locator timeouts.
  104 |   const routes = [
  105 |     '/',
  106 |     '/foundations',
  107 |     '/motion',
  108 |     '/states',
  109 |     '/system-tools/icons',
  110 |     '/reference-resources',
  111 |     '/reference-resources/create',
  112 |     '/reference-resources/detail?id=resource-alpha',
  113 |     '/reference-resources/edit?id=resource-alpha',
  114 |     ...[
  115 |       '',
  116 |       'navigation',
  117 |       'data-display',
  118 |       'locale',
  119 |       'notifications',
  120 |       'accessibility',
  121 |       'shortcuts',
  122 |       'actions',
  123 |     ].map((p) => `/settings${p ? '/' + p : ''}`),
  124 |     ...[
  125 |       'actions-selection',
  126 |       'feedback',
  127 |       'status-async',
  128 |       'identity-display',
  129 |       'navigation',
  130 |       'data',
  131 |       'surfaces',
  132 |       'forms',
  133 |       'overlays',
  134 |     ].map((p) => `/ui-elements/${p}`),
  135 |     ...[
  136 |       'layout-navigation',
  137 |       'collections-data',
  138 |       'forms-actions',
  139 |       'detail-settings',
  140 |       'states-feedback',
  141 |     ].map((p) => `/page-patterns/${p}`),
  142 |     ...[
  143 |       'overview',
  144 |       'resource-list',
  145 |       'create-edit',
  146 |       'detail',
  147 |       'settings',
  148 |       'master-detail',
  149 |       'operation',
  150 |     ].map((p) => `/page-archetypes/${p}`),
  151 |   ];
  152 |   const results = [];
  153 |   const errors: string[] = [];
  154 |   page.on('pageerror', (error) => errors.push(error.message));
  155 |   for (const route of routes) {
  156 |     await page.goto(route);
  157 |     await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  158 |     await expect(page.locator('main h1')).toBeVisible();
  159 |     await page.evaluate(() => document.fonts.ready);
  160 |     if (route === '/ui-elements/forms')
  161 |       await expect(page.getByRole('group', { name: 'DatePicker', exact: true })).toBeVisible();
  162 |     const before = await page.evaluate(() => document.documentElement.scrollHeight);
  163 |     await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  164 |     await page.waitForTimeout(350);
  165 |     const sample = await page.evaluate(() => ({
  166 |       height: document.documentElement.scrollHeight,
  167 |       overflow: document.documentElement.scrollWidth > innerWidth,
  168 |       units: document.querySelectorAll('main [data-reveal]').length,
  169 |       nested: Array.from(document.querySelectorAll('main [data-reveal]')).some((e) =>
  170 |         Boolean(e.parentElement?.closest('[data-reveal]')),
  171 |       ),
  172 |       hidden: Array.from(document.querySelectorAll('main [data-reveal="revealed"]')).some(
  173 |         (e) => getComputedStyle(e).opacity === '0',
  174 |       ),
  175 |     }));
  176 |     expect(sample.height, route).toBe(before);
  177 |     expect(sample.overflow, route).toBe(false);
  178 |     expect(sample.hidden, route).toBe(false);
  179 |     expect(sample.nested, route).toBe(false);
  180 |     expect(sample.units, route).toBeGreaterThan(0);
  181 |     results.push({ route, ...sample });
  182 |   }
  183 |   expect(errors).toEqual([]);
  184 |   await mkdir(evidence, { recursive: true });
```
