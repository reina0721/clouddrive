# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: authentication.spec.ts >> Authentication layouts remain accessible at 320
- Location: apps\web\e2e\authentication.spec.ts:66:3

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  11069 pixels (ratio 0.05 of all image pixels) are different.

  Snapshot: authentication-login-320.png

Call log:
  - Expect "soft toHaveScreenshot(authentication-login-320.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 11069 pixels (ratio 0.05 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 11069 pixels (ratio 0.05 of all image pixels) are different.

```

```
Error: expect(page).toHaveScreenshot(expected) failed

  Expected an image 320px by 986px, received 320px by 990px. 12941 pixels (ratio 0.05 of all image pixels) are different.

  Snapshot: authentication-register-320.png

Call log:
  - Expect "soft toHaveScreenshot(authentication-register-320.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - Expected an image 320px by 986px, received 320px by 990px. 12941 pixels (ratio 0.05 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - Expected an image 320px by 986px, received 320px by 990px. 12941 pixels (ratio 0.05 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [active] [ref=f3e1]:
    - button "Open Next.js Dev Tools" [ref=f3e7] [cursor=pointer]
    - alert [ref=f3e11]
    - link "跳到主要内容 / Skip to content" [ref=f3e12] [cursor=pointer]:
        - /url: '#main-content'
    - main [ref=f3e13]:
        - generic [ref=f3e14]:
            - link "C clouddrive" [ref=f3e15] [cursor=pointer]:
                - /url: /welcome
                - generic [ref=f3e16]: C
                - generic [ref=f3e17]: clouddrive
            - generic [ref=f3e18]:
                - button "切换语言" [ref=f3e19] [cursor=pointer]
                - button "切换主题" [ref=f3e20] [cursor=pointer]
        - generic [ref=f3e22]:
            - generic [ref=f3e23]:
                - generic [ref=f3e26]:
                    - heading "欢迎使用 Community" [level=1] [ref=f3e27]
                    - paragraph [ref=f3e28]: 一个拥有统一界面、导航与个人偏好的后台工作台。
                - link "进入工作台" [ref=f3e29] [cursor=pointer]:
                    - /url: /
                - link "注册账户" [ref=f3e30] [cursor=pointer]:
                    - /url: /register
            - complementary [ref=f3e31]:
                - paragraph [ref=f3e32]: 开发演示模式
                - paragraph [ref=f3e33]: 这是本地模拟认证，可注册演示账户。请勿使用真实密码。
                - paragraph [ref=f3e34]: 演示邮箱：demo@community.test
                - paragraph [ref=f3e35]: 演示密码：CommunityDemo2026!
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import AxeBuilder from '@axe-core/playwright';
  3   | import { defaultPreferences, PREFERENCES_VERSION } from '@clouddrive/surface/preferences-model';
  4   |
  5   | test.use({ storageState: { cookies: [], origins: [] } });
  6   |
  7   | async function login(page: Page) {
  8   |   await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('demo@community.test');
  9   |   await page.getByLabel('密码', { exact: true }).fill('CommunityDemo2026!');
  10  |   await page.getByRole('button', { name: '登录', exact: true }).click();
  11  | }
  12  |
  13  | test('Anonymous deep link preserves destination; login restores identity; logout protects content', async ({
  14  |   page,
  15  | }) => {
  16  |   await page.goto('/settings/accessibility?source=auth#motion');
  17  |   await expect(page).toHaveURL(/\/login\?returnTo=/);
  18  |   expect(new URL(page.url()).searchParams.get('returnTo')).toBe(
  19  |     '/settings/accessibility?source=auth#motion',
  20  |   );
  21  |   await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  22  |   await page.getByRole('button', { name: '显示密码', exact: true }).click();
  23  |   await expect(page.getByLabel('密码', { exact: true })).toHaveAttribute('type', 'text');
  24  |   await page.getByRole('button', { name: '隐藏密码', exact: true }).click();
  25  |   await login(page);
  26  |   await expect(page).toHaveURL(/\/settings\/accessibility\?source=auth#motion$/);
  27  |   await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
  28  |   await page.reload();
  29  |   await page.getByRole('button', { name: '当前用户', exact: true }).click();
  30  |   await expect(page.getByText('demo@community.test', { exact: true })).toBeVisible();
  31  |   await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  32  |   await expect(page).toHaveURL(/\/login$/);
  33  |   await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  34  |   await page.goto('/reference-resources');
  35  |   await expect(page).toHaveURL(/\/login\?returnTo=/);
  36  | });
  37  |
  38  | test('Registration validates confirmation, displays success and persists only salted password digest', async ({
  39  |   page,
  40  | }) => {
  41  |   await page.goto('/register');
  42  |   await page.getByRole('textbox', { name: '姓名', exact: true }).fill('Auth Review');
  43  |   await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('review@example.test');
  44  |   await page.getByLabel('密码', { exact: true }).fill('UniqueDemoPass2026!');
  45  |   await page.getByLabel('确认密码', { exact: true }).fill('DifferentPassword!');
  46  |   await page.getByRole('button', { name: '创建账户', exact: true }).click();
  47  |   await expect(page.getByText('两次输入的密码不一致。', { exact: true })).toBeVisible();
  48  |   await expect(page.getByLabel('确认密码', { exact: true })).toBeFocused();
  49  |   await page.getByLabel('确认密码', { exact: true }).fill('UniqueDemoPass2026!');
  50  |   await page.getByRole('button', { name: '创建账户', exact: true }).click();
  51  |   await expect(page.getByText('账户已创建', { exact: true })).toBeVisible();
  52  |   const stored = await page.evaluate(() => localStorage.getItem('clouddrive.auth-mock'));
  53  |   expect(stored).not.toContain('UniqueDemoPass2026!');
  54  |   expect(stored).toMatch(/"digest":"[0-9a-f]{64}"/);
  55  |   await page.getByRole('button', { name: '继续进入工作台', exact: true }).click();
  56  |   await page.getByRole('button', { name: '当前用户', exact: true }).click();
  57  |   await expect(page.getByRole('menu').getByText('Auth Review', { exact: true })).toBeVisible();
  58  |   await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  59  |   await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('review@example.test');
  60  |   await page.getByLabel('密码', { exact: true }).fill('UniqueDemoPass2026!');
  61  |   await page.getByRole('button', { name: '登录', exact: true }).click();
  62  |   await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
  63  | });
  64  |
  65  | for (const width of [320, 390, 768, 1440, 2048]) {
  66  |   test(`Authentication layouts remain accessible at ${width}`, async ({ page }) => {
  67  |     await page.setViewportSize({ width, height: 844 });
  68  |     for (const path of ['/login', '/register', '/session-expired', '/welcome']) {
  69  |       await page.goto(path);
  70  |       await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  71  |       await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  72  |       expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
  73  |         true,
  74  |       );
  75  |       const axe = await new AxeBuilder({ page })
  76  |         .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
  77  |         .analyze();
  78  |       expect(axe.violations).toEqual([]);
  79  |       if (path === '/login' || path === '/register')
  80  |         await page.screenshot({
  81  |           path: `docs/changes/109-ui-ux-optimization/evidence/authentication/${path.slice(1)}-${width}.png`,
  82  |           fullPage: true,
  83  |         });
  84  |       if ((width === 320 || width === 1440) && (path === '/login' || path === '/register'))
> 85  |         await expect.soft(page).toHaveScreenshot(`authentication-${path.slice(1)}-${width}.png`, {
      |                                 ^ Error: expect(page).toHaveScreenshot(expected) failed
  86  |           fullPage: true,
  87  |         });
  88  |     }
  89  |   });
  90  | }
  91  |
  92  | test('Invalid credentials keep the form usable and reject external return targets', async ({
  93  |   page,
  94  | }) => {
  95  |   await page.goto('/login?returnTo=https%3A%2F%2Fexample.com');
  96  |   await page.getByRole('textbox', { name: '邮箱', exact: true }).fill('demo@community.test');
  97  |   await page.getByLabel('密码', { exact: true }).fill('WrongPassword2026!');
  98  |   await page.getByRole('button', { name: '登录', exact: true }).click();
  99  |   await expect(page.getByText('邮箱或密码不正确，请重试。', { exact: true })).toBeVisible();
  100 |   await expect(page.getByRole('button', { name: '登录', exact: true })).toBeEnabled();
  101 |   await login(page);
  102 |   await expect(page).toHaveURL('http://127.0.0.1:4173/');
  103 | });
  104 |
  105 | test('Existing sessions redirect guest routes and corrupt demo records can be repaired explicitly', async ({
  106 |   page,
  107 | }) => {
  108 |   await page.goto('/login');
  109 |   await login(page);
  110 |   await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
  111 |   await page.goto('/login?returnTo=%2Fsettings%2Fnotifications');
  112 |   await expect(page).toHaveURL('http://127.0.0.1:4173/settings/notifications');
  113 |   await page.evaluate(() => localStorage.setItem('clouddrive.auth-mock', 'damaged-record'));
  114 |   await page.goto('/login');
  115 |   await expect(
  116 |     page.getByText('认证响应或本地记录无效，请联系维护者。', { exact: true }),
  117 |   ).toBeVisible();
  118 |   await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  119 |   expect(await page.evaluate(() => localStorage.getItem('clouddrive.auth-mock'))).toBe(
  120 |     'damaged-record',
  121 |   );
  122 |   await page.evaluate(() => localStorage.removeItem('clouddrive.auth-mock'));
  123 |   await page.getByRole('button', { name: '重试', exact: true }).click();
  124 |   await expect(page.getByRole('textbox', { name: '邮箱', exact: true })).toBeVisible();
  125 | });
  126 |
  127 | test('The authority password control supports keyboard visibility and preserves its input', async ({
  128 |   page,
  129 | }) => {
  130 |   await page.goto('/ui-elements/forms');
  131 |   await expect(page).toHaveURL(/\/login\?returnTo=/);
  132 |   await login(page);
  133 |   const password = page.getByLabel('密码输入', { exact: true });
  134 |   await password.fill('KeyboardRetained2026!');
  135 |   await password.focus();
  136 |   await page.keyboard.press('Tab');
  137 |   const show = page.getByRole('button', { name: '显示密码', exact: true }).first();
  138 |   await expect(show).toBeFocused();
  139 |   await page.keyboard.press('Space');
  140 |   await expect(password).toHaveAttribute('type', 'text');
  141 |   await expect(password).toHaveValue('KeyboardRetained2026!');
  142 |   const hide = page.getByRole('button', { name: '隐藏密码', exact: true });
  143 |   await hide.press('Space');
  144 |   await expect(password).toHaveAttribute('type', 'password');
  145 | });
  146 |
  147 | test('Session expiry removes protected content and returns to the expired-session form', async ({
  148 |   page,
  149 | }) => {
  150 |   await page.goto('/login');
  151 |   await login(page);
  152 |   await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
  153 |   await page.evaluate(() => {
  154 |     const key = 'clouddrive.auth-mock';
  155 |     // Change only the expiration in this test's known persisted fixture.
  156 |     const record = localStorage.getItem(key);
  157 |     if (!record) throw new Error('Expected the established demo session');
  158 |     localStorage.setItem(
  159 |       key,
  160 |       record.replace(/"expiresAt":\d+/, `"expiresAt":${Date.now() + 2000}`),
  161 |     );
  162 |   });
  163 |   await page.reload();
  164 |   await expect(page).toHaveURL(/\/session-expired\?returnTo=/);
  165 |   await expect(page.getByText('会话已过期', { exact: true })).toBeVisible();
  166 |   await expect(page.getByRole('button', { name: '当前用户', exact: true })).toHaveCount(0);
  167 | });
  168 |
  169 | test('Logout synchronizes other tabs and clears private records while retaining device preferences', async ({
  170 |   page,
  171 |   context,
  172 | }) => {
  173 |   await page.goto('/login');
  174 |   await login(page);
  175 |   await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
  176 |   const second = await context.newPage();
  177 |   await second.goto('/settings');
  178 |   await expect(second.getByRole('button', { name: '当前用户', exact: true })).toBeVisible();
  179 |   await page.evaluate(() => {
  180 |     localStorage.setItem('clouddrive.test-private', JSON.stringify({ secret: 'previous-owner' }));
  181 |     sessionStorage.setItem('clouddrive.test-private', 'previous-owner');
  182 |   });
  183 |   await page.getByRole('button', { name: '当前用户', exact: true }).click();
  184 |   await page.getByRole('menuitem', { name: '退出登录', exact: true }).click();
  185 |   await expect(page).toHaveURL(/\/login$/);
```
