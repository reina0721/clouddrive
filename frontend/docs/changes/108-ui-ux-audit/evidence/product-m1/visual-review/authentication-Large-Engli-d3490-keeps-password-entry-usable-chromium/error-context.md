# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: authentication.spec.ts >> Large English dark mobile registration keeps password entry usable
- Location: apps\web\e2e\authentication.spec.ts:219:1

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  Expected an image 320px by 1262px, received 320px by 1267px. 20701 pixels (ratio 0.06 of all image pixels) are different.

  Snapshot: authentication-register-320-en-dark-large.png

Call log:
  - Expect "soft toHaveScreenshot(authentication-register-320-en-dark-large.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - Expected an image 320px by 1262px, received 320px by 1267px. 20701 pixels (ratio 0.06 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - Expected an image 320px by 1262px, received 320px by 1267px. 20701 pixels (ratio 0.06 of all image pixels) are different.

```

# Page snapshot

```yaml
- generic [ref=e1]:
    - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]
    - alert [ref=e11]
    - link "跳到主要内容 / Skip to content" [ref=e12] [cursor=pointer]:
        - /url: '#main-content'
    - main [ref=e13]:
        - generic [ref=e14]:
            - link "C clouddrive" [ref=e15] [cursor=pointer]:
                - /url: /welcome
                - generic [ref=e16]: C
                - generic [ref=e17]: clouddrive
            - generic [ref=e18]:
                - button "Switch language" [ref=e19] [cursor=pointer]
                - button "Switch theme" [ref=e20] [cursor=pointer]
        - generic [ref=e22]:
            - generic [ref=e23]:
                - generic [ref=e26]:
                    - heading "Create your account" [level=1] [ref=e27]
                    - paragraph [ref=e28]: Add your details to get started with Community.
                - generic [ref=e29]:
                    - generic [ref=e30]:
                        - generic [ref=e31]: Name
                        - textbox "Name" [ref=e32]
                    - generic [ref=e33]:
                        - generic [ref=e34]: Email
                        - textbox "Email" [ref=e35]
                    - generic [ref=e36]:
                        - generic [ref=e37]: Password
                        - textbox "Password" [ref=e38]
                        - button "Show password" [ref=e40] [cursor=pointer]
                        - generic [ref=e41]: Use 12–128 characters. A unique, long passphrase is recommended.
                    - generic [ref=e42]:
                        - generic [ref=e43]: Confirm password
                        - textbox "Confirm password" [active] [ref=e44]: LargeMobileDemo2026!
                        - button "Show confirmation" [ref=e46] [cursor=pointer]
                    - button "Create account" [ref=e47] [cursor=pointer]
                - paragraph [ref=e49]:
                    - text: Already have an account?
                    - link "Sign in" [ref=e50] [cursor=pointer]:
                        - /url: /login?returnTo=%2F
            - complementary [ref=e51]:
                - paragraph [ref=e52]: Development demo mode
                - paragraph [ref=e53]: This is local simulated authentication. You can create a demo account. Do not use a real password.
                - paragraph [ref=e54]: 'Demo email: demo@community.test'
                - paragraph [ref=e55]: 'Demo password: CommunityDemo2026!'
```

# Test source

```ts
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
  186 |   await expect(second).toHaveURL(/\/login\?returnTo=/);
  187 |   expect(await page.evaluate(() => localStorage.getItem('clouddrive.test-private'))).toBeNull();
  188 |   expect(await page.evaluate(() => sessionStorage.getItem('clouddrive.test-private'))).toBeNull();
  189 |   expect(await page.evaluate(() => localStorage.getItem('clouddrive.shell'))).not.toBeNull();
  190 |   await second.close();
  191 | });
  192 |
  193 | for (const width of [320, 1440]) {
  194 |   test(`English dark authentication respects reduced motion at ${width}`, async ({ page }) => {
  195 |     await page.setViewportSize({ width, height: 844 });
  196 |     await page.emulateMedia({ reducedMotion: 'reduce' });
  197 |     await page.goto('/register');
  198 |     await page.getByRole('button', { name: '切换语言', exact: true }).click();
  199 |     await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  200 |     await page.getByRole('button', { name: 'Switch theme', exact: true }).click();
  201 |     await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  202 |     await expect(
  203 |       page.getByRole('heading', { name: 'Create your account', exact: true }),
  204 |     ).toBeVisible();
  205 |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
  206 |       true,
  207 |     );
  208 |     const axe = await new AxeBuilder({ page })
  209 |       .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
  210 |       .analyze();
  211 |     expect(axe.violations).toEqual([]);
  212 |     await page.screenshot({
  213 |       path: `docs/changes/109-ui-ux-optimization/evidence/authentication/register-en-dark-${width}.png`,
  214 |       fullPage: true,
  215 |     });
  216 |   });
  217 | }
  218 |
  219 | test('Large English dark mobile registration keeps password entry usable', async ({ page }) => {
  220 |   await page.setViewportSize({ width: 320, height: 844 });
  221 |   await page.addInitScript(
  222 |     ({ preferences, version }) => {
  223 |       localStorage.setItem(
  224 |         'clouddrive.shell',
  225 |         JSON.stringify({
  226 |           version,
  227 |           state: {
  228 |             preferences: {
  229 |               ...preferences,
  230 |               appearance: { ...preferences.appearance, fontScale: 'large', themeMode: 'dark' },
  231 |               localeRegion: { ...preferences.localeRegion, language: 'en' },
  232 |             },
  233 |           },
  234 |         }),
  235 |       );
  236 |     },
  237 |     { preferences: defaultPreferences, version: PREFERENCES_VERSION },
  238 |   );
  239 |   await page.goto('/register');
  240 |   const password = page.getByLabel('Confirm password', { exact: true });
  241 |   await password.fill('LargeMobileDemo2026!');
  242 |   await expect(password).toHaveValue('LargeMobileDemo2026!');
  243 |   const box = await password.boundingBox();
  244 |   expect(box?.width).toBeGreaterThanOrEqual(80);
  245 |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  246 |   const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  247 |   expect(axe.violations).toEqual([]);
  248 |   await page.screenshot({
  249 |     path: 'docs/changes/109-ui-ux-optimization/evidence/authentication/register-320-en-dark-large.png',
  250 |     fullPage: true,
  251 |   });
> 252 |   await expect.soft(page).toHaveScreenshot('authentication-register-320-en-dark-large.png', {
      |                           ^ Error: expect(page).toHaveScreenshot(expected) failed
  253 |     fullPage: true,
  254 |   });
  255 | });
  256 |
```
