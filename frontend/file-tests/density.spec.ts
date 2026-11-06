import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const readAccess = async () =>
  JSON.parse(
    (
      await readFile(
        resolve(
          __dirname,
          process.env.CLOUDDRIVE_FILE_TEST_ACCESS ?? '../../.data/preview-access.json',
        ),
        'utf8',
      )
    ).replace(/^\uFEFF/, ''),
  ) as { url: string; username: string; password: string };
async function login(page: Page) {
  const access = await readAccess();
  await page.goto(new URL('/login?returnTo=%2Fhome', access.url).href);
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}
async function create(page: Page, path: string, body: unknown): Promise<{ id: string }> {
  return page.evaluate(
    async ({ path, body }) => {
      const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
      const response = await fetch('/api/console/v1/native/files' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw Error('Layout fixture API failed: ' + response.status);
      return (await response.json()) as { id: string };
    },
    { path, body },
  );
}
let fixture: { root: string; empty: string; longParent: string; longName: string };
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN' });
  const page = await context.newPage();
  try {
    await login(page);
    const root = await create(page, '/folders', {
      parentId: '',
      name: '视觉密度-' + randomUUID().slice(0, 8),
    });
    const empty = await create(page, '/folders', { parentId: root.id, name: '空目录' });
    const longName = 'LongFileName'.repeat(9) + '.txt';
    for (let index = 0; index < 29; index++)
      await create(page, '/text', {
        parentId: root.id,
        name: index === 0 ? longName : '密度样本-' + String(index).padStart(2, '0') + '.txt',
        text: '真实文件布局样本',
        key: randomUUID(),
      });
    let parent = root.id;
    for (let index = 0; index < 3; index++)
      parent = (
        await create(page, '/folders', { parentId: parent, name: '长目录名称'.repeat(12) + index })
      ).id;
    fixture = { root: root.id, empty: empty.id, longParent: parent, longName };
  } finally {
    await context.close();
  }
});
test.beforeEach(async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/home?parent=' + fixture.root);
  await expect(page.locator('[data-file-item]')).toHaveCount(31);
});
async function noHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
}

test('F301–308：桌面独立滚动、稳定工具、可见存储与完整品牌', async ({ page }, info) => {
  const header = page.locator('[data-file-workspace-header]');
  const before = await header.boundingBox();
  const main = page.locator('[data-file-scroll-region]');
  await expect(page.getByRole('region', { name: '存储空间', exact: true })).toBeInViewport();
  const brand = page.getByRole('link', { name: 'clouddrive', exact: true });
  await expect(brand).toBeVisible();
  await expect.poll(() => brand.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  await main.hover();
  await page.mouse.wheel(0, 1000);
  await expect.poll(() => main.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  expect((await header.boundingBox())?.y).toBe(before?.y);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await expect(page.getByRole('region', { name: '存储空间', exact: true })).toBeInViewport();
  await page.getByRole('button', { name: '收起文件导航', exact: true }).click();
  await expect(page.getByRole('link', { name: '我的分享', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '展开文件导航', exact: true }).click();
  await page.screenshot({ path: info.outputPath('desktop-scroll.png') });
});
test('F316–319：紧凑网格、长名称、列表和键盘焦点', async ({ page }, info) => {
  const cards = page.locator('[data-file-item]');
  const first = await cards.nth(0).boundingBox();
  const sixth = await cards.nth(5).boundingBox();
  expect(first?.y).toBe(sixth?.y);
  expect(first?.height).toBeLessThan(220);
  // 分页必须排在完整文件集合之后，不能与网格内容重叠。
  const lastCard = await cards.last().boundingBox();
  const pagination = await page.getByText('第 1 / 1 页，共 31 项', { exact: true }).boundingBox();
  if (!lastCard || !pagination) throw new Error('无法测量文件集合与分页位置');
  expect(pagination.y).toBeGreaterThanOrEqual(lastCard.y + lastCard.height);
  const long = page.getByRole('button', { name: fixture.longName, exact: true });
  await expect(long).toHaveAttribute('title', fixture.longName);
  await page.screenshot({ path: info.outputPath('compact-grid.png') });
  await page.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('menuitem', { name: '列表', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  expect((await cards.first().boundingBox())?.height).toBeLessThan(72);
  await long.focus();
  await page.keyboard.press('End');
  await expect.poll(() => page.locator('[data-file-entry]:focus').count()).toBe(1);
  await expect(page.locator('[data-file-entry]:focus')).toBeInViewport();
  await noHorizontalOverflow(page);
  await page.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('menuitem', { name: '网格', exact: true }).click();
});
test('F314–315：根目录隐藏无效返回，长路径和完整路径菜单可用', async ({ page }) => {
  await page.goto('/home');
  await expect(page.getByRole('button', { name: '上级目录', exact: true })).toHaveCount(0);
  await page.goto('/home?parent=' + fixture.longParent);
  await expect(page.getByRole('button', { name: '上级目录', exact: true })).toBeVisible();
  await noHorizontalOverflow(page);
  await page.getByRole('button', { name: '完整目录路径', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: '我的文件', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '上级目录', exact: true }).click();
  await expect(page).not.toHaveURL(new RegExp(fixture.longParent));
});
test('F309–313：320px与390px工具、移动抽屉和浮层', async ({ page }, info) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await noHorizontalOverflow(page);
    await expect(page.getByRole('button', { name: '完整目录路径', exact: true })).toBeInViewport();
    await page.getByRole('button', { name: '文件导航', exact: true }).click();
    await expect(page.getByRole('link', { name: '我的分享', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '新建', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: '上传文件', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '当前用户', exact: true })).toBeInViewport();
  }
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('mobile-workspace.png') });
});
test('F320：空目录居中引导及真实上传入口', async ({ page }, info) => {
  await page.goto('/home?parent=' + fixture.empty);
  const empty = page.locator('[data-file-empty]');
  await expect(empty).toBeVisible();
  await expect(empty.getByRole('button', { name: '上传文件', exact: true })).toBeVisible();
  // 不只检查可见性，还检查空态在桌面与高视口中都位于内容区中央。
  for (const height of [720, 1080]) {
    await page.setViewportSize({ width: 1280, height });
    const contentBox = await page.locator('[data-file-content]').boundingBox();
    const emptyBox = await empty.boundingBox();
    if (!contentBox || !emptyBox) throw new Error('无法测量空态与内容区');
    expect(
      Math.abs(emptyBox.y + emptyBox.height / 2 - contentBox.y - contentBox.height / 2),
    ).toBeLessThan(2);
  }
  await page.screenshot({ path: info.outputPath('empty-directory.png') });
});
test('英文深色与超宽屏保留工具、网格和无障碍', async ({ page }, info) => {
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: /^主题 / }).click();
  await page.getByRole('menuitemradio', { name: '深色', exact: true }).click();
  await page.getByRole('button', { name: '当前用户', exact: true }).click();
  await page.getByRole('menuitem', { name: '语言 简体中文', exact: true }).click();
  await page.getByRole('menuitemradio', { name: 'English', exact: true }).click();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await noHorizontalOverflow(page);
  await expect(page.getByRole('button', { name: 'Current user', exact: true })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('wide-dark-english.png') });
});

// 固定项使用真实服务端引用，不能用注入假DOM来证明滚动区域有效。
test('F307：多个真实固定项独立滚动并可打开', async ({ page }, info) => {
  const folderIds: string[] = [];
  const suffix = randomUUID().slice(0, 6);
  const mutatePin = async (targetId: string, action: 'add' | 'remove') =>
    page.evaluate(
      async ({ targetId, remove }) => {
        const csrf = (await (await fetch('/api/console/v1/auth/csrf')).json()) as { token: string };
        const pins = (await (await fetch('/api/console/v1/native/files/pins')).json()) as {
          revision: number;
          items: { id: string; targetId: string }[];
        };
        const pin = pins.items.find((item) => item.targetId === targetId);
        if (remove && !pin) return;
        const response = await fetch(
          '/api/console/v1/native/files/pins' + (remove ? '/' + encodeURIComponent(pin!.id) : ''),
          {
            method: remove ? 'DELETE' : 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
            body: JSON.stringify({
              revision: pins.revision,
              ...(remove ? {} : { targetKind: 'folder', targetId }),
            }),
          },
        );
        if (response.status !== 200) throw Error('Real pin operation failed: ' + response.status);
      },
      { targetId, remove: action === 'remove' },
    );
  const failures: unknown[] = [];
  try {
    for (let index = 0; index < 8; index++) {
      const folder = await create(page, '/folders', {
        parentId: fixture.empty,
        name: '固定滚动-' + suffix + '-' + index,
      });
      folderIds.push(folder.id);
      await mutatePin(folder.id, 'add');
    }
    await page.reload();
    const region = page.locator('[data-file-pins-region]');
    const last = region.getByRole('link', { name: '固定滚动-' + suffix + '-7', exact: true });
    await expect(last).toBeVisible();
    await expect
      .poll(() => region.evaluate((element) => element.scrollHeight > element.clientHeight))
      .toBe(true);
    await last.scrollIntoViewIfNeeded();
    await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(page.getByRole('region', { name: '存储空间', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.screenshot({ path: info.outputPath('pinned-links-scroll.png') });
    await last.click();
    await expect(page).toHaveURL(new RegExp('parent=' + folderIds.at(-1)));
  } catch (error) {
    failures.push(error);
  }
  for (const id of folderIds) {
    try {
      await mutatePin(id, 'remove');
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, '固定项验证或清理失败');
});
