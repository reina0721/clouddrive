# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workbench-mobile-109.spec.ts >> Mobile workbench detail preserves identity, selection and list focus
- Location: apps\web\e2e\workbench-mobile-109.spec.ts:4:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173/page-archetypes/resource-list
Call log:
  - navigating to "http://127.0.0.1:4173/page-archetypes/resource-list", waiting until "load"

```

# Test source

```ts
  1  | import AxeBuilder from '@axe-core/playwright';
  2  | import { expect, test } from '@playwright/test';
  3  |
  4  | test('Mobile workbench detail preserves identity, selection and list focus', async ({ page }) => {
  5  |   await page.setViewportSize({ width: 390, height: 844 });
> 6  |   await page.goto('/page-archetypes/resource-list');
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:4173/page-archetypes/resource-list
  7  |   const rows = page.getByRole('grid').getByRole('row');
  8  |   await expect(rows).toHaveCount(21);
  9  |   const row = rows.nth(1);
  10 |   const recordId = await row.getAttribute('data-key');
  11 |   if (!recordId) throw new Error('The first workbench row must have a stable identity');
  12 |   await row.click();
  13 |   const detail = page.getByRole('dialog');
  14 |   await expect(detail).toBeVisible();
  15 |   await expect(detail).toContainText(recordId);
  16 |   const accessibility = await new AxeBuilder({ page })
  17 |     .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  18 |     .analyze();
  19 |   expect(accessibility.violations).toEqual([]);
  20 |   await detail.getByRole('button', { name: '关闭详情', exact: true }).click();
  21 |   await expect(detail).toBeHidden();
  22 |   await expect(row).toHaveAttribute('data-selected', 'true');
  23 |   await expect
  24 |     .poll(() => row.evaluate((element) => element.contains(document.activeElement)))
  25 |     .toBe(true);
  26 |   await expect(row).toBeInViewport();
  27 |
  28 |   const nextRow = rows.nth(2);
  29 |   const nextId = await nextRow.getAttribute('data-key');
  30 |   if (!nextId) throw new Error('The next workbench row must have a stable identity');
  31 |   await nextRow.click();
  32 |   await expect(detail).toContainText(nextId);
  33 |   await page.setViewportSize({ width: 1280, height: 900 });
  34 |   await expect(detail).toBeHidden();
  35 |   await expect(page.getByRole('complementary').nth(1)).toContainText(nextId);
  36 |   await expect(nextRow).toHaveAttribute('data-selected', 'true');
  37 | });
  38 |
```
