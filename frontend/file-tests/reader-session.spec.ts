import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { readPreviewAccess } from './reading-fixture';

async function login(page: Page) {
  const access = readPreviewAccess();
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}

async function fixture(page: Page) {
  return page.evaluate(async (suffix) => {
    const base = '/api/console/v1';
    const { token } = (await (await fetch(base + '/auth/csrf')).json()) as { token: string };
    async function create(path: string, body: unknown) {
      const response = await fetch(base + '/native/files' + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Fixture HTTP ' + response.status);
      return (await response.json()) as { id: string; name: string };
    }
    const root = await create('/folders', { parentId: '', name: '阅读会话-' + suffix });
    const next = await create('/folders', { parentId: root.id, name: '另一个目录-' + suffix });
    const file = await create('/text', {
      parentId: root.id,
      name: '迟到的文件-' + suffix + '.txt',
      text: 'This reader belongs to the previous directory.',
      key: suffix,
    });
    return { root, next, file };
  }, randomUUID());
}

test('离开目录后，迟到的应用选择响应不能打开旧文件', async ({ page }) => {
  await login(page);
  const { root, next, file } = await fixture(page);
  await page.goto('/home?parent=' + root.id);
  await expect(page.getByRole('button', { name: file.name, exact: true })).toBeVisible();
  let release!: () => void;
  let requested!: () => void;
  let delivered!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const settled = new Promise<void>((resolve) => {
    delivered = resolve;
  });
  await page.route('**/native/files/applications/active', async (route) => {
    const response = await route.fetch();
    requested();
    await gate;
    try {
      await route.fulfill({ response });
    } finally {
      delivered();
    }
  });
  await page.getByRole('button', { name: file.name, exact: true }).click();
  await started;
  await page.getByRole('button', { name: next.name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp('parent=' + next.id));
  release();
  await settled;
  // 给已完成响应一次完整打开窗口；断言的是旧阅读器始终没有出现。
  const opened = await page
    .getByRole('dialog')
    .waitFor({ state: 'visible', timeout: 1500 })
    .then(
      () => true,
      () => false,
    );
  expect(opened, 'A reader from the previous directory opened after navigation').toBe(false);
  await expect(
    page.getByRole('heading', { level: 1, name: next.name, exact: true }),
  ).toBeAttached();
});
