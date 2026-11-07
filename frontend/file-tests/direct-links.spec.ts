import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('单项和批量获取直链、复制、管理与撤销', async ({ page, context }, testInfo) => {
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
  ) as { purpose?: string; username: string; password: string; url: string };
  test.skip(access.purpose !== 'direct-links-fixture', '直链验证使用独立验收账号。');
  const origin = new URL(access.url).origin;
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  await page.goto('/login?returnTo=%2Fhome');
  await page.getByLabel('邮箱', { exact: true }).fill(access.username);
  await page.getByLabel('密码', { exact: true }).fill(access.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  const names = ['直链演示甲', '直链演示乙'].map(
    (name) => name + '-' + randomUUID().slice(0, 8) + '.txt',
  );
  for (const name of names) {
    const status = await page.evaluate(
      async ({ name, key }) => {
        const csrf = await fetch('/api/console/v1/auth/csrf', { cache: 'no-store' });
        const { token } = (await csrf.json()) as { token: string };
        const response = await fetch('/api/console/v1/native/files/text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
          body: JSON.stringify({ parentId: '', name, text: '直链真实内容', key }),
        });
        return response.status;
      },
      { name, key: randomUUID() },
    );
    expect(status).toBe(200);
  }
  await page.reload();
  const [first, second] = names as [string, string];
  await page.getByRole('button', { name: first + ' 的操作', exact: true }).click();
  await page.getByRole('menuitem', { name: '获取直链', exact: true }).click();
  const issue = page.getByRole('dialog', { name: '获取直链', exact: true });
  await expect(issue).toContainText('无需登录');
  await expect(issue.getByRole('link')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('direct-links-desktop.png') });
  await issue.getByRole('button', { name: '生成直链', exact: true }).click();
  const firstAddress = issue.getByRole('link');
  await expect(firstAddress).toHaveCount(1);
  const firstURL = await firstAddress.getAttribute('href');
  expect(firstURL?.startsWith(origin + '/api/v1/file-direct-links/')).toBeTruthy();
  await issue.getByRole('button', { name: '复制下载链接', exact: true }).click();
  await expect(issue).toContainText('链接已复制');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    firstURL + '?download=true',
  );
  await issue.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(issue).toHaveCount(0);
  for (const name of [first, second]) {
    const selection = page.getByRole('checkbox', { name: '选择 ' + name, exact: true });
    await selection.press('Space');
    await expect(selection).toBeChecked();
  }
  await page.getByRole('button', { name: '获取直链', exact: true }).click();
  await issue.getByRole('button', { name: '生成直链', exact: true }).click();
  await expect(issue.getByRole('link')).toHaveCount(2);
  await issue.getByRole('button', { name: '复制全部链接', exact: true }).click();
  await expect(issue).toContainText('链接已复制');
  const batch = (await page.evaluate(() => navigator.clipboard.readText())).split('\n');
  expect(batch).toHaveLength(2);
  expect(batch.includes(firstURL ?? '')).toBeTruthy();
  await issue.getByRole('button', { name: '关闭', exact: true }).click();

  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/home/shares');
  await page.getByRole('button', { name: '管理直链', exact: true }).click();
  const manage = page.getByRole('dialog', { name: '管理直链', exact: true });
  await expect(manage).toContainText(first);
  await expect(manage).toContainText(second);
  const row = manage.getByText(first, { exact: true }).locator('..');
  await row.getByRole('button', { name: '撤销', exact: true }).click();
  const confirm = manage.getByRole('button', { name: '确认撤销', exact: true });
  await expect(confirm).toBeVisible();
  const [scrollWidth, width] = await manage.evaluate((element) => [
    element.scrollWidth,
    element.clientWidth,
  ]);
  expect(scrollWidth).toBeLessThanOrEqual(width);
  await confirm.click();
  await expect(manage).toContainText('直链已撤销');
  await expect(manage.getByText(first, { exact: true })).toHaveCount(0);
  await expect(manage).toContainText(second);
  const anonymous = await fetch(firstURL ?? '', { signal: AbortSignal.timeout(5000) });
  expect(anonymous.status).toBe(404);
  await anonymous.arrayBuffer();
  await page.screenshot({ path: testInfo.outputPath('direct-links-mobile.png') });
});
