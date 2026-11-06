import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

async function login(page: Page) {
  const access = JSON.parse(
    (
      await readFile(
        resolve(
          __dirname,
          process.env.CLOUDDRIVE_FILE_TEST_ACCESS ?? '../../.data/preview-access.json',
        ),
        'utf8',
      )
    ).replace(/^\uFEFF/, ''),
  ) as { username: string; password: string };
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  return access;
}
async function mutate(page: Page, path: string, method: string, body?: unknown) {
  const response = await page.evaluate(
    async ({ path, method, body }) => {
      const csrf = (await (
        await fetch('/api/console/v1/auth/csrf', { credentials: 'include', cache: 'no-store' })
      ).json()) as { token: string };
      const response = await fetch('/api/console/v1/native/files' + path, {
        method,
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.token },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        value: response.status === 204 ? {} : ((await response.json()) as Record<string, unknown>),
      };
    },
    { path, method, body },
  );
  expect([200, 204], method + ' ' + path).toContain(response.status);
  return response.value;
}
async function fixture(page: Page, password = '') {
  const suffix = randomUUID().slice(0, 8),
    folder = await mutate(page, '/folders', 'POST', { name: '原分享-' + suffix, parentId: '' });
  const file = await mutate(page, '/text', 'POST', {
    name: 'original-' + suffix + '.txt',
    parentId: folder.id,
    text: '快捷方式不会删除原始内容',
    key: randomUUID(),
  });
  const share = await mutate(page, '/shares', 'POST', { rootId: folder.id, password });
  return {
    suffix,
    folder,
    file,
    share,
    address: new URL('/share#token=' + String(share.token), page.url()).href,
  };
}
async function confirm(page: Page, label: string) {
  await page.getByRole('dialog').getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function rowAction(page: Page, name: string, action: string) {
  await page.getByRole('button', { name: name + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
  await expect(page.getByRole('dialog', { name: name + ' 的操作', exact: true })).toHaveCount(0);
}

test('分享快捷方式、三类固定、CAS排序、回收恢复与引用移除', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  const fixtureValue = await fixture(page),
    name = '保存-' + fixtureValue.suffix,
    renamed = '别名-' + fixtureValue.suffix;
  const currentPins = await mutate(page, '/pins', 'GET');
  const existingShared = (currentPins.items as { id: string; targetKind: string }[]).find(
    (pin) => pin.targetKind === 'shared',
  );
  if (existingShared)
    await mutate(page, '/pins/' + existingShared.id, 'DELETE', { revision: currentPins.revision });
  await mutate(page, '/folders', 'POST', {
    name: '整理-' + fixtureValue.suffix,
    parentId: '',
  });
  await page.getByRole('link', { name: '与我共享', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: '与我共享', exact: true })).toBeVisible();
  await page
    .getByRole('searchbox', { name: '搜索快捷方式', exact: true })
    .fill(fixtureValue.suffix);
  await page.getByRole('main').getByRole('button', { name: '搜索快捷方式', exact: true }).click();
  await page.getByRole('button', { name: '保存分享快捷方式', exact: true }).first().click();
  let dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('本实例分享链接', { exact: true })
    .fill(fixtureValue.address.replace(new URL(page.url()).origin, 'https://elsewhere.test'));
  await dialog.getByLabel('快捷方式名称', { exact: true }).fill(name);
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('快捷方式名称', { exact: true })).toHaveValue(name);
  await dialog.getByLabel('本实例分享链接', { exact: true }).fill(fixtureValue.address);
  await dialog
    .getByRole('button', { name: '整理-' + fixtureValue.suffix + '/', exact: true })
    .click();
  await expect(dialog).toContainText('当前目录: /整理-' + fixtureValue.suffix);
  await confirm(page, '保存');
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  // 共享视图与快捷方式均由真实确认动作固定。
  await page.getByRole('button', { name: '固定到侧边栏', exact: true }).click();
  await confirm(page, '固定到侧边栏');
  await rowAction(page, name, '固定到侧边栏');
  await confirm(page, '固定到侧边栏');
  await rowAction(page, name, '重命名');
  await page.getByRole('dialog').getByLabel('快捷方式名称', { exact: true }).fill(renamed);
  await confirm(page, '重命名');
  const pins = page.getByRole('region', { name: '固定项', exact: true });
  await expect(pins.getByRole('link', { name: renamed, exact: true })).toBeVisible();
  await rowAction(page, renamed, '移动');
  await page.getByRole('dialog').getByRole('button', { name: '/', exact: true }).click();
  await confirm(page, '移动');
  await rowAction(page, renamed, '复制');
  await page
    .getByRole('dialog')
    .getByLabel('快捷方式名称', { exact: true })
    .fill('副本-' + fixtureValue.suffix);
  await confirm(page, '复制');
  await expect(
    page.getByRole('heading', { name: '副本-' + fixtureValue.suffix, exact: true }),
  ).toBeVisible();
  const popupPromise = page.waitForEvent('popup');
  await page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: renamed, exact: true }) })
    .getByRole('link', { name: '打开原分享' })
    .click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/share#token=/);
  await expect(popup.getByText(String(fixtureValue.file.name), { exact: true })).toBeVisible();
  await popup.close();
  await page.getByRole('link', { name: '我的文件', exact: true }).first().click();
  await expect(page).toHaveURL(/\/home$/);
  // 在确认面板打开后由另一请求改变版本，面板不得覆盖新顺序。
  await rowAction(page, '整理-' + fixtureValue.suffix, '固定到侧边栏');
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '固定到侧边栏', exact: true })).toBeEnabled();
  const snapshot = await mutate(page, '/pins', 'GET');
  const ids = (snapshot.items as { id: string }[]).map((item) => item.id).reverse();
  await mutate(page, '/pins/order', 'PUT', { revision: snapshot.revision, ids });
  await dialog.getByRole('button', { name: '固定到侧边栏', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByRole('button', { name: '刷新', exact: true }).click();
  await confirm(page, '固定到侧边栏');
  await page.getByRole('button', { name: '管理固定项', exact: true }).click();
  dialog = page.getByRole('dialog');
  // 等待刚保存的目录进入当前快照，并按稳定名称定位，避免刷新重排期间绑定旧的last按钮。
  const folderPin = dialog.getByText('整理-' + fixtureValue.suffix, { exact: true }).locator('..');
  await expect(folderPin.getByRole('button', { name: '上移', exact: true })).toBeEnabled();
  const beforeReorder = (await mutate(page, '/pins', 'GET')).items as {
    id: string;
    name: string;
  }[];
  const folderIndex = beforeReorder.findIndex((pin) => pin.name === '整理-' + fixtureValue.suffix);
  expect(folderIndex).toBeGreaterThan(0);
  const expectedOrder = beforeReorder.map((pin) => pin.id);
  [expectedOrder[folderIndex - 1], expectedOrder[folderIndex]] = [
    expectedOrder[folderIndex]!,
    expectedOrder[folderIndex - 1]!,
  ];
  await folderPin.getByRole('button', { name: '上移', exact: true }).click();
  await expect
    .poll(async () =>
      ((await mutate(page, '/pins', 'GET')).items as { id: string }[]).map((pin) => pin.id),
    )
    .toEqual(expectedOrder);
  await expect(folderPin.getByRole('button', { name: '取消固定', exact: true })).toBeEnabled();
  await folderPin.getByRole('button', { name: '取消固定', exact: true }).click();
  await confirm(page, '关闭');
  await rowAction(page, renamed, '移入回收站');
  await confirm(page, '确认');
  await page.getByRole('link', { name: '回收站', exact: true }).click();
  await rowAction(page, renamed, '恢复');
  await confirm(page, '确认');
  await page
    .getByRole('navigation', { name: '我的文件', exact: true })
    .getByRole('link', { name: '我的文件', exact: true })
    .click();
  await rowAction(page, renamed, '移入回收站');
  await confirm(page, '确认');
  await page.getByRole('link', { name: '回收站', exact: true }).click();
  await rowAction(page, renamed, '永久移除快捷方式');
  await expect(page.getByRole('dialog')).toContainText('不会删除原分享或原文件');
  await confirm(page, '永久移除快捷方式');
  await mutate(page, '/' + String(fixtureValue.file.id), 'GET');
  await page.getByRole('link', { name: '与我共享', exact: true }).first().click();
  await page
    .getByRole('searchbox', { name: '搜索快捷方式', exact: true })
    .fill(fixtureValue.suffix);
  await page.getByRole('button', { name: '搜索快捷方式', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '副本-' + fixtureValue.suffix, exact: true }),
  ).toBeVisible();
  await expect(page.locator('section[aria-busy="true"]')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('shared-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: '与我共享', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('shared-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('匿名分享保存经过登录返回，密码授权与原分享撤销仍实时生效', async ({ page, context }) => {
  test.setTimeout(120_000);
  const access = await login(page),
    password = randomUUID(),
    value = await fixture(page, password),
    alias = '需密码-' + value.suffix;
  await context.clearCookies();
  await page.goto(value.address);
  await expect(page.getByLabel('访问密码', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '保存分享快捷方式', exact: true }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fhome%2Fshared#returnFragment=/);
  expect(new URL(page.url()).search).not.toContain(String(value.share.token));
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('本实例分享链接', { exact: true })).toHaveValue(value.address);
  await dialog.getByLabel('快捷方式名称', { exact: true }).fill(alias);
  await confirm(page, '保存');
  expect(new URL(page.url()).hash).toBe('');
  await page.getByRole('searchbox', { name: '搜索快捷方式', exact: true }).fill(value.suffix);
  await page.getByRole('button', { name: '搜索快捷方式', exact: true }).click();
  const row = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: alias, exact: true }) });
  await expect(row).toContainText('需要密码');
  const popupPromise = page.waitForEvent('popup');
  await row.getByRole('link', { name: '打开原分享' }).click();
  const popup = await popupPromise;
  await expect(popup.getByLabel('访问密码', { exact: true })).toBeVisible();
  await popup.getByLabel('访问密码', { exact: true }).fill(password);
  await popup.getByRole('button', { name: '访问分享', exact: true }).click();
  await expect(popup.getByText(String(value.file.name), { exact: true })).toBeVisible();
  await popup.close();
  await mutate(page, '/shares/' + String(value.share.id) + '/revoke', 'POST');
  await page.getByRole('button', { name: '刷新', exact: true }).first().click();
  await expect(row).toContainText('已撤销');
  await expect(row.getByRole('link', { name: '打开原分享' })).toHaveCount(0);
});

test('保存引用搜索、当前状态筛选和稳定游标翻页', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  const value = await fixture(page),
    prefix = '分页-' + value.suffix;
  const saved: string[] = [];
  try {
    for (let index = 0; index < 21; index++) {
      const entry = await mutate(page, '/shortcuts', 'POST', {
        token: value.share.token,
        parentId: '',
        name: prefix + '-' + String(index).padStart(2, '0'),
      });
      saved.push(String(entry.id));
    }
    await page.getByRole('link', { name: '与我共享', exact: true }).first().click();
    await page.getByRole('searchbox', { name: '搜索快捷方式', exact: true }).fill(prefix);
    await page.getByRole('button', { name: '搜索快捷方式', exact: true }).click();
    await expect(page.getByRole('heading', { name: new RegExp('^' + prefix) })).toHaveCount(20);
    await page.getByRole('button', { name: '下一页', exact: true }).click();
    await expect(page.getByRole('heading', { name: new RegExp('^' + prefix) })).toHaveCount(1);
    await page.getByRole('button', { name: '上一页', exact: true }).click();
    await expect(page.getByRole('heading', { name: new RegExp('^' + prefix) })).toHaveCount(20);
    await page.getByRole('button', { name: /分享状态/ }).click({ timeout: 10_000 });
    await page.getByRole('option', { name: '需要密码', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: '还没有保存的分享', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: /分享状态/ }).click({ timeout: 10_000 });
    await page.getByRole('option', { name: '可访问', exact: true }).click();
    await expect(page.getByRole('heading', { name: new RegExp('^' + prefix) })).toHaveCount(20);
  } finally {
    for (const id of saved) {
      const trashed = await mutate(page, '/' + id + '/trash', 'POST');
      await mutate(page, '/shortcuts/' + id, 'DELETE', { revision: trashed.contentRevision });
    }
  }
});
