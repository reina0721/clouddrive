import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

type Definition = { key: string; name: string; kind: string };
type Definitions = { revision: number; items: Definition[] };

test('管理员定义文件属性，窄屏编辑并保留移除定义后的值', async ({ page }, info) => {
  const accessPath = process.env.CLOUDDRIVE_FILE_TEST_ACCESS;
  test.skip(!accessPath, '全局定义验收仅使用隔离预览。');
  const account = JSON.parse(
    (await readFile(resolve(__dirname, accessPath!), 'utf8')).replace(/^\uFEFF/, ''),
  ) as {
    url: string;
    username: string;
    password: string;
  };
  const origin = new URL(account.url).origin;
  expect(origin).toBe('http://127.0.0.1:4194');
  await page.goto(origin + '/login?returnTo=%2Fsystem-tools%2Ffilesystem');
  await page.getByLabel('邮箱', { exact: true }).fill(account.username);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/system-tools\/filesystem$/);
  await page.getByRole('tab', { name: '自定义属性', exact: true }).click();
  const suffix = randomUUID().slice(0, 8);
  const key = 'test-' + suffix;
  const display = '验收属性 ' + suffix;
  const fileName = '属性文件-' + suffix + '.txt';
  const api = (path: string, method = 'GET', body?: unknown) =>
    page.evaluate(
      async ({ path, method, body }) => {
        const { token } = (await (await fetch('/api/console/v1/auth/csrf')).json()) as {
          token: string;
        };
        const result = await fetch('/api/console/v1/native/files' + path, {
          method,
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': token,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        if (!result.ok) throw new Error('Property fixture failed with HTTP ' + result.status);
        return (await result.json()) as unknown;
      },
      { path, method, body },
    );
  let saveAttempted = false;
  try {
    await page.getByRole('button', { name: '添加属性', exact: true }).click();
    const form = page.getByRole('dialog', { name: '添加属性', exact: true });
    await form.getByLabel('标识', { exact: true }).fill('invalid key');
    await form.getByLabel('名称', { exact: true }).fill(display);
    await expect(form.getByRole('button', { name: '保存', exact: true })).toBeDisabled();
    await form.getByLabel('标识', { exact: true }).fill(key);
    await form.getByLabel('最小长度', { exact: true }).fill('2');
    await form.getByLabel('最大长度', { exact: true }).fill('6');
    const preset = form.getByRole('checkbox', { name: '设置默认值', exact: true });
    await preset.press('Space');
    await expect(preset).toBeChecked();
    await form.getByLabel('默认值', { exact: true }).fill('默认');
    saveAttempted = true;
    await form.getByRole('button', { name: '保存', exact: true }).click();
    const row = page.getByRole('row').filter({ hasText: key });
    await expect(row).toContainText(display);
    await page.screenshot({
      animations: 'disabled',
      path: info.outputPath('property-definitions-desktop.png'),
    });

    const folder = (await api('/folders', 'POST', {
      name: '属性验收-' + suffix,
      parentId: '',
    })) as { id: string };
    const fixture = (await api('/text', 'POST', {
      parentId: folder.id,
      name: fileName,
      key: randomUUID(),
      text: 'qa property fixture',
    })) as { id: string };
    await page.setViewportSize({ width: 320, height: 760 });
    await page.goto(origin + '/home?parent=' + encodeURIComponent(folder.id));
    await page.getByRole('button', { name: fileName + ' 的操作', exact: true }).click();
    await page.getByRole('menuitem', { name: '属性', exact: true }).click();
    const details = page.getByRole('dialog', { name: fileName, exact: true });
    await details.getByRole('button', { name: /全局属性/ }).click();
    await page.getByRole('option', { name: display, exact: true }).click();
    await details.getByRole('button', { name: '添加已定义属性', exact: true }).click();
    await expect(details.getByLabel(display, { exact: true })).toHaveValue('默认');
    await details.getByLabel(display, { exact: true }).fill('测试值');
    await details.getByRole('button', { name: '保存整理信息', exact: true }).click();
    await expect(details.getByText('整理信息已保存', { exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await details.getByLabel(display, { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({
      animations: 'disabled',
      path: info.outputPath('property-edit-mobile.png'),
    });

    await page.goto(origin + '/system-tools/filesystem');
    await page.getByRole('tab', { name: '自定义属性', exact: true }).click();
    await row.getByRole('button', { name: '移除定义', exact: true }).click();
    await page
      .getByRole('dialog', { name: '移除定义', exact: true })
      .getByRole('button', { name: '移除定义', exact: true })
      .click();
    await expect(row).toHaveCount(0);
    const persisted = (await api('/' + fixture.id + '/annotations')) as {
      annotation: { properties: { key: string; value: string }[] };
    };
    expect(persisted.annotation.properties).toContainEqual({
      key,
      value: '测试值',
    });
  } finally {
    if (saveAttempted) {
      const current = (await api('/property-definitions')) as Definitions;
      if (current.items.some((definition) => definition.key === key)) {
        await api('/property-definitions', 'PUT', {
          revision: current.revision,
          items: current.items.filter((definition) => definition.key !== key),
        });
      }
    }
  }
});
