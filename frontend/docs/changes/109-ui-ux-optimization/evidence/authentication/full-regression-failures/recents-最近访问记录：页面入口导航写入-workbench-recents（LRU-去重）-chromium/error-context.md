# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recents.spec.ts >> 最近访问记录：页面入口导航写入 workbench recents（LRU 去重）
- Location: apps\web\e2e\recents.spec.ts:3:1

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected value: "/settings"
Received array: []
```

# Page snapshot

```yaml
- generic [active] [ref=f3e1]:
    - button "Open Next.js Dev Tools" [ref=f3e7] [cursor=pointer]
    - alert [ref=f3e11]
    - main "正在加载应用" [ref=f3e12]:
        - generic [ref=f3e13]:
            - status [ref=f3e14]:
                - status "正在加载应用" [ref=f3e15]:
                    - status
                - generic [ref=f3e16]: 正在加载应用
            - status "正在加载应用" [ref=f3e17]
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  |
  3  | test('最近访问记录：页面入口导航写入 workbench recents（LRU 去重）', async ({ page }) => {
  4  |   // 清空 workbench（保持确定性）。
  5  |   await page.goto('/settings');
  6  |   await page.evaluate(() => window.localStorage.removeItem('clouddrive.workbench'));
  7  |   await page.reload();
  8  |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  9  |
  10 |   // 访问两个页面入口（设置 + 参考资源）。
  11 |   await page.goto('/settings');
  12 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  13 |   await page.goto('/reference-resources');
  14 |   await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  15 |
  16 |   // workbench localStorage：recents 含最近访问（reference-resources 在前）。
  17 |   // state-foundation 持久化信封：{ state: {...}, version }。
  18 |   const workbench = await page.evaluate(() => {
  19 |     const raw = window.localStorage.getItem('clouddrive.workbench');
  20 |     return raw
  21 |       ? (JSON.parse(raw) as { state?: { recents?: Array<{ pathname: string; title: string }> } })
  22 |       : null;
  23 |   });
  24 |   expect(workbench?.state).not.toBeNull();
  25 |   const recents = workbench?.state?.recents ?? [];
  26 |   const pathnames = recents.map((entry) => entry.pathname);
> 27 |   expect(pathnames).toContain('/settings');
     |                     ^ Error: expect(received).toContain(expected) // indexOf
  28 |   expect(pathnames).toContain('/reference-resources');
  29 |   expect(pathnames[0]).toBe('/reference-resources'); // 最近在前
  30 |   expect(recents[0]?.title.length ?? 0).toBeGreaterThan(0); // 标题非空（i18n 解析）
  31 | });
  32 |
```
