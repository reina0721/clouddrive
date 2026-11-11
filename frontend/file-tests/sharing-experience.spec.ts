import { randomUUID } from 'node:crypto';
import { expect, test, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openReadingFixtureFolder, readPreviewAccess } from './reading-fixture';

test.use({ actionTimeout: 15_000 });

async function login(page: Page) {
  const account = readPreviewAccess();
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}

async function openShare(page: Page) {
  await login(page);
  await openReadingFixtureFolder(page, '分享体验-');
  const name = '交接说明-' + randomUUID().slice(0, 8) + '.txt';
  const parentId = new URL(page.url()).searchParams.get('parent');
  const id = await page.evaluate(
    async ({ parentId, name }) => {
      const { token } = (await (await fetch('/api/console/v1/auth/csrf')).json()) as {
        token: string;
      };
      const response = await fetch('/api/console/v1/native/files/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({
          parentId,
          name,
          key: crypto.randomUUID(),
          text: '需要交接的真实文件。',
        }),
      });
      if (!response.ok) throw new Error('Create share fixture HTTP ' + response.status);
      return ((await response.json()) as { id: string }).id;
    },
    { parentId, name },
  );
  await page.reload();
  await page.getByRole('button', { name: name + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '分享', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '分享', exact: true });
  await expect(dialog.getByRole('button', { name: /谁可以访问/ })).toBeVisible();
  return { dialog, name, id };
}

async function select(page: Page, within: Locator, label: string, value: string) {
  await within.getByRole('button', { name: new RegExp(label) }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
}

async function noAccessibilityErrors(page: Page) {
  // 只等待浮层实际透明度和颜色过渡，页面可能保留等待滚动的动画。
  await expect
    .poll(() =>
      page.getByRole('dialog').evaluateAll((dialogs) =>
        dialogs.every((dialog) => {
          let element: Element | null = dialog;
          while (element) {
            if (Number(getComputedStyle(element).opacity) !== 1) return false;
            element = element.parentElement;
          }
          return true;
        }),
      ),
    )
    .toBe(true);
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) => animation instanceof CSSTransition && animation.playState === 'running',
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
}

test('分享先明确访问与能力，创建过程保留窗口，结果能复制并让访客打开', async ({
  page,
  browser,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 1280, height: 800 });
  const { dialog, name } = await openShare(page);
  await expect(dialog.getByRole('checkbox', { name: '修改文字内容', exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel('完整账号标识', { exact: true })).toHaveCount(0);
  const create = dialog.getByRole('button', { name: '创建分享链接', exact: true });
  await expect(create).toBeInViewport();
  await noAccessibilityErrors(page);
  await page.screenshot({ path: info.outputPath('share-create-desktop.png') });

  await select(page, dialog, '分享权限', '可编辑');
  await expect(
    dialog.getByText('查看、下载和修改文字内容，不改变原文件的位置和名称。', { exact: true }),
  ).toBeVisible();
  await select(page, dialog, '分享权限', '自定义');
  await dialog.getByRole('checkbox', { name: '预览内容', exact: true }).press('Space');
  await expect(dialog.getByRole('checkbox', { name: '预览内容', exact: true })).not.toBeChecked();
  await expect(create).toBeDisabled();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await select(page, dialog, '分享权限', '只读');
  await expect(create).toBeEnabled();
  await select(page, dialog, '谁可以访问', '自定义访问规则');
  await expect(dialog.getByLabel('完整账号标识', { exact: true })).toBeVisible();
  await select(page, dialog, '谁可以访问', '获得链接的任何人');
  const password = randomUUID();
  await dialog.getByLabel('访问密码（可选）', { exact: true }).fill(password);
  await select(page, dialog, '有效期', '1 小时');
  await dialog.getByRole('button', { name: '添加分享标题', exact: true }).click();
  await dialog.getByLabel('分享标题（可选）', { exact: true }).fill('给同事的交接说明');
  await page.route(
    '**/api/console/v1/native/files/shares',
    (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
    { times: 1 },
  );
  await create.click();
  await expect(dialog.getByRole('alert')).toBeFocused();
  await expect(dialog.getByLabel('分享标题（可选）', { exact: true })).toHaveValue(
    '给同事的交接说明',
  );
  await expect(dialog.getByLabel('访问密码（可选）', { exact: true })).toHaveValue(password);
  await expect(create).toBeEnabled();

  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route('**/api/console/v1/native/files/shares', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    requests++;
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  try {
    await create.click();
    await expect.poll(() => requests).toBe(1);
    await expect(create).toBeDisabled();
    await expect(dialog.getByRole('button', { name: '关闭', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
  } finally {
    release();
  }
  await expect(dialog.getByRole('heading', { name: '链接已准备好', exact: true })).toBeVisible();
  expect(requests).toBe(1);
  await expect(dialog.getByText('密码保护', { exact: true })).toBeVisible();
  await expect(dialog.getByText('获得链接的任何人', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '复制链接', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '链接已复制', exact: true })).toBeVisible();
  const link = await dialog.getByRole('link').getAttribute('href');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  await noAccessibilityErrors(page);
  await page.screenshot({ path: info.outputPath('share-ready-desktop.png') });
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new DOMException('Clipboard is unavailable', 'NotAllowedError')),
    });
  });
  await dialog.getByRole('button', { name: '链接已复制', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeFocused();
  await expect(dialog.getByRole('button', { name: '复制链接', exact: true })).toBeVisible();
  await expect(dialog.getByRole('link')).toBeVisible();

  const guest = await browser.newContext({ locale: 'zh-CN' });
  try {
    const visitor = await guest.newPage();
    await visitor.goto(link!);
    await expect(visitor.getByRole('heading', { name: /分享/ })).toBeVisible();
    await visitor.getByLabel('访问密码', { exact: true }).fill(password);
    await visitor.getByRole('button', { name: '访问分享', exact: true }).click();
    await expect(visitor.getByRole('article').getByText(name, { exact: true })).toBeVisible();
    await expect(visitor.getByRole('button', { name: '编辑文字', exact: true })).toHaveCount(0);
  } finally {
    await guest.close();
  }
});

test('手机分享与详情可达，登录范围真正拒绝匿名访问', async ({ page, browser }, info) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const { dialog, name } = await openShare(page);
  await select(page, dialog, '谁可以访问', '已登录本站的用户');
  await expect(dialog.getByRole('button', { name: '创建分享链接', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await noAccessibilityErrors(page);
  await page.screenshot({ path: info.outputPath('share-create-mobile.png') });
  await dialog.getByRole('button', { name: '创建分享链接', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: '链接已准备好', exact: true })).toBeVisible();
  const link = await dialog.getByRole('link').getAttribute('href');
  const guest = await browser.newContext({ locale: 'zh-CN' });
  try {
    const visitor = await guest.newPage();
    await visitor.goto(link!);
    await expect(visitor.getByRole('link', { name: '登录后重试', exact: true })).toBeVisible();
    await expect(visitor.getByText(name, { exact: true })).toHaveCount(0);
  } finally {
    await guest.close();
  }
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await page.goto('/home/shares');
  await page.getByLabel('搜索标题或原文件名', { exact: true }).fill(name);
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  const card = page.locator('[data-share-id]').filter({ hasText: name });
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: '分享详情', exact: true }).click();
  const detail = page.getByRole('dialog', { name, exact: true });
  await expect(detail.getByText('已登录本站的用户', { exact: true })).toBeVisible();
  await expect(detail.getByRole('button', { name: '复制链接', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await noAccessibilityErrors(page);
  await page.screenshot({ path: info.outputPath('share-detail-mobile.png') });
});

test('共享表单页脚使用真实提交语义，外部操作结束前不能提前关闭', async ({ page }) => {
  await login(page);
  await page.goto('/ui-elements/overlays');
  const trigger = page.getByRole('button', { name: '带固定操作的表单', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '带固定操作的表单', exact: true });
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('操作进行中，关闭与重复提交已暂停。');
  await expect(dialog.getByRole('button', { name: '关闭', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '完成操作', exact: true }).click();
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('分享的深色英文与复杂选项在窄屏仍清晰可用', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { dialog, name } = await openShare(page);
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  const originalTheme = await page.getByRole('menuitemradio', { checked: true }).innerText();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  let english = false;
  try {
    await page.getByRole('button', { name: '当前用户', exact: true }).click();
    await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
    english = true;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Actions for ' + name, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Share', exact: true }).click();
    const sharing = page.getByRole('dialog', { name: 'Share', exact: true });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(
      sharing.getByRole('button', { name: 'Create share link', exact: true }),
    ).toBeInViewport();
    await noAccessibilityErrors(page);
    await page.screenshot({ path: info.outputPath('share-dark-english-mobile.png') });
    await select(page, sharing, 'Share permissions', 'Custom');
    await select(page, sharing, 'Who can access', 'Custom access rules');
    await expect(sharing.getByLabel('Exact account identifier', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await noAccessibilityErrors(page);
    await page.screenshot({ path: info.outputPath('share-custom-dark-english-mobile.png') });
    await sharing.getByRole('button', { name: 'Close', exact: true }).click();
  } finally {
    if (!page.isClosed()) {
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await page
        .getByRole('button', { name: english ? 'Current user' : '当前用户', exact: true })
        .click();
      if (english) {
        await page.getByRole('menuitem', { name: 'Language English', exact: true }).click();
        await page.getByRole('menuitemradio', { name: '简体中文', exact: true }).click();
        await page.getByRole('button', { name: '当前用户', exact: true }).click();
      }
      await page.getByRole('menuitem', { name: /^主题 / }).click();
      await page.getByRole('menuitemradio', { name: originalTheme, exact: true }).click();
    }
  }
});
