import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { safeParseWorkspaceSnapshot } from '@clouddrive/surface/api-workbench';

const workspaceKey = 'clouddrive.api-workbench.workspace.v1';
async function denyWorkspaceWrites(page: Page) {
  await page.evaluate((key) => {
    const setLocal = localStorage.setItem.bind(localStorage);
    const setSession = sessionStorage.setItem.bind(sessionStorage);
    sessionStorage.setItem('fixture-workbench-deny-save', 'true');
    Storage.prototype.setItem = function (name, value) {
      if (name === key && sessionStorage.getItem('fixture-workbench-deny-save') === 'true')
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return (this === localStorage ? setLocal : setSession)(name, value);
    };
  }, workspaceKey);
}

async function openWorkbench(page: Page, width = 1920, height = 1080) {
  await page.setViewportSize({ width, height });
  await page.goto('/api-workbench');
  await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
  await expect(page.getByRole('heading', { name: 'API 调试工作台', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '请求 URL', exact: true })).toBeVisible();
}
async function selectRequest(page: Page, name: string) {
  const open = page.getByRole('button', { name: '项目与接口', exact: true });
  if (await open.isVisible()) await open.click();
  await page.getByRole('row', { name, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: name.replace(/^(GET|POST) /, ''), exact: true }),
  ).toBeVisible();
}
async function assertAccessible(page: Page, selector = '[data-workbench-layout]') {
  await page.locator(selector).evaluateAll(async (elements) => {
    const animations = new Set<Animation>();
    for (const element of elements) {
      for (const animation of element.getAnimations({ subtree: true })) animations.add(animation);
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        for (const animation of ancestor.getAnimations()) animations.add(animation);
      }
    }
    await Promise.all(
      [...animations]
        .filter(
          (animation) =>
            animation.playState === 'running' &&
            Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)),
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const result = await new AxeBuilder({ page })
    .include(selector)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(result.violations).toEqual([]);
}

test.describe('API workbench execution and state', () => {
  test('executes a mock request, exposes assertion details and request history', async ({
    page,
  }) => {
    await openWorkbench(page);
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await expect(page.getByText('200 OK', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '断言详情', exact: true }).click();
    await expect(page.getByText('✓ 状态 200', { exact: true })).toBeVisible();
    await expect(page.getByText('✓ 返回有效用户列表', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: '历史', exact: true }).click();
    await expect(page.getByRole('button', { name: /mock:\/\/users/ })).toBeVisible();
    await assertAccessible(page);
  });

  test('runner and manual task runs report the same real failure', async ({ page }) => {
    await openWorkbench(page);
    await page.getByRole('tab', { name: '集合运行', exact: true }).click();
    await page.getByRole('button', { name: '运行集合测试', exact: true }).click();
    await expect(page.getByText('成功 2 · 失败 1 · 总计 3', { exact: true })).toBeVisible();
    await expect(page.getByText('HTTP 错误；断言通过不改变请求失败的判定。')).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath('runner-result.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('tab', { name: '任务', exact: true }).click();
    await expect(page.getByRole('switch', { name: '状态', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: '立即运行', exact: true }).click();
    await expect(page.getByText('成功 2 · 失败 1 · 总计 3', { exact: true })).toBeVisible();
    await expect(page.getByText('手动运行完成，全部断言通过')).toHaveCount(0);
    await page.screenshot({
      path: test.info().outputPath('task-result.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await assertAccessible(page);
  });

  test('retains per-request drafts across selection, resizing and variable saves', async ({
    page,
  }) => {
    await openWorkbench(page, 390, 844);
    await selectRequest(page, 'POST 模拟登录认证 (POST)');
    const url = page.getByRole('textbox', { name: '请求 URL', exact: true });
    await url.fill('mock://draft-login');
    await selectRequest(page, 'GET 获取用户列表 (Mock)');
    await selectRequest(page, 'POST 模拟登录认证 (POST)');
    await expect(url).toHaveValue('mock://draft-login');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.locator('[data-workbench-layout]')).toHaveAttribute(
      'data-workbench-layout',
      'expanded',
    );
    await expect(url).toHaveCount(1);
    await expect(url).toHaveValue('mock://draft-login');
    await page.getByRole('button', { name: '工作区', exact: true }).click();
    await page.getByRole('menuitem', { name: '设置全局变量', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: '环境变量与全局变量管理', exact: true });
    await expect(drawer.getByRole('tab', { name: '全局变量', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await drawer
      .getByRole('textbox', { name: '参数值', exact: true })
      .fill('Updated workspace name');
    await drawer.getByRole('button', { name: '保存变量', exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await expect(url).toHaveValue('mock://draft-login');
    await url.fill('{{baseUrl}}auth/login');
    await expect(page.getByText('未保存', { exact: true })).toHaveCount(0);
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  });

  test('a failed durable write retains the draft and never reports Saved', async ({ page }) => {
    await openWorkbench(page);
    await denyWorkspaceWrites(page);
    await page.getByRole('textbox', { name: '请求 URL', exact: true }).fill('mock://unsaved');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('未保存', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '请求 URL', exact: true })).toHaveValue(
      'mock://unsaved',
    );
    await expect(
      page
        .locator('[data-workbench-layout]')
        .getByRole('alert')
        .filter({ hasText: '保存失败，修改仍保留，请重试' }),
    ).toBeVisible();
    await expect(page.getByText('已保存', { exact: true })).toHaveCount(0);
  });

  test('invalid JSON has a field error and destructive body format changes require confirmation', async ({
    page,
  }) => {
    await openWorkbench(page);
    await selectRequest(page, 'POST 模拟登录认证 (POST)');
    await page.getByRole('tab', { name: '请求体', exact: true }).click();
    const body = page.getByRole('textbox', { name: '请求内容', exact: true });
    await body.fill('{');
    await page.getByRole('button', { name: '格式化 JSON', exact: true }).click();
    await expect(
      page.getByText('JSON 格式无效，请检查括号、引号和逗号。', { exact: true }),
    ).toBeVisible();
    await expect(body).toHaveValue('{');
    await page.getByRole('button', { name: 'JSON 格式', exact: true }).click();
    await page.getByRole('option', { name: '无请求体', exact: true }).click();
    const confirm = page.getByRole('alertdialog', { name: '更改请求体格式', exact: true });
    await assertAccessible(page, '[role="alertdialog"]');
    await confirm.getByRole('button', { name: '取消', exact: true }).click();
    await expect(body).toHaveValue('{');
  });

  test('imports only after reviewing a valid replacement and handles invalid files', async ({
    page,
  }) => {
    await openWorkbench(page);
    const raw = await page.evaluate((key) => localStorage.getItem(key), workspaceKey);
    const parsed: unknown = JSON.parse(raw ?? '{}');
    const validation = safeParseWorkspaceSnapshot(parsed);
    if (!validation.success) throw new Error('Missing workspace fixture');
    const replacement = {
      ...validation.data,
      projects: validation.data.projects.map((project, index) =>
        index === 0 ? { ...project, name: 'Imported workspace' } : project,
      ),
    };
    await page.getByRole('button', { name: '工作区', exact: true }).click();
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('menuitem', { name: '导入工作区', exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: 'workspace.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(replacement)),
    });
    const confirm = page.getByRole('alertdialog', { name: '导入并替换工作区', exact: true });
    await expect(confirm.getByText('项目 1 · 集合 1 · 接口 3', { exact: true })).toBeVisible();
    await confirm.getByRole('button', { name: '确认替换', exact: true }).click();
    await expect(page.getByRole('row', { name: 'Imported workspace', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '工作区', exact: true }).click();
    const invalidChooser = page.waitForEvent('filechooser');
    await page.getByRole('menuitem', { name: '导入工作区', exact: true }).click();
    await (
      await invalidChooser
    ).setFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{') });
    await expect(
      page.getByText('导入失败，请选择符合工作区规范的 JSON 文件', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('row', { name: 'Imported workspace', exact: true })).toBeVisible();
  });
});

test('failed task record saves can retry without executing the requests again', async ({
  page,
}) => {
  await openWorkbench(page);
  await page.getByRole('tab', { name: '任务', exact: true }).click();
  await denyWorkspaceWrites(page);
  await page.getByRole('button', { name: '立即运行', exact: true }).click();
  const unsaved = page.getByRole('group', { name: '未保存的运行记录', exact: true });
  await expect(unsaved).toBeVisible();
  const completedAt = await unsaved.locator('time').getAttribute('datetime');
  await page.evaluate(() => sessionStorage.removeItem('fixture-workbench-deny-save'));
  await unsaved.getByRole('button', { name: '重试保存记录', exact: true }).click();
  await expect(unsaved).toHaveCount(0);
  await expect(
    page.getByRole('group', { name: '每 5 分钟健康自检', exact: true }).locator('time'),
  ).toHaveAttribute('datetime', completedAt ?? '');
  await expect(page.getByText('成功 2 · 失败 1 · 总计 3', { exact: true })).toBeVisible();
});

test('load failures are recoverable without replacing invalid workspace data', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, '{'), workspaceKey);
  await page.goto('/api-workbench');
  await expect(page.getByRole('heading', { name: '工作区加载失败', exact: true })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), workspaceKey)).toBe('{');
  await page.evaluate((key) => localStorage.removeItem(key), workspaceKey);
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '请求 URL', exact: true })).toBeVisible();
});

test('transport failure, empty response and denied clipboard have distinct feedback', async ({
  page,
}) => {
  await openWorkbench(page);
  const url = page.getByRole('textbox', { name: '请求 URL', exact: true });
  await url.fill('unsupported://invalid');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByRole('heading', { name: '请求失败', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeEnabled();
  await page.route('**/workbench-empty-response', (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
  await url.fill(new URL('/workbench-empty-response', page.url()).href);
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByRole('heading', { name: '响应体为空', exact: true })).toBeVisible();
  await assertAccessible(page);
  await url.fill('mock://users');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) },
    }),
  );
  await page.getByRole('button', { name: '复制', exact: true }).click();
  await expect(page.getByText('复制失败，请重试或手动选择内容', { exact: true })).toBeVisible();
});

test('named creation, search recovery, task validation and delete cancellation', async ({
  page,
}) => {
  await openWorkbench(page);
  await page.getByRole('button', { name: '新建', exact: true }).click();
  await page.getByRole('menuitem', { name: '新建接口', exact: true }).click();
  const creation = page.getByRole('dialog', { name: '新建接口', exact: true });
  await expect(creation.getByRole('button', { name: '创建', exact: true })).toBeDisabled();
  await creation.getByRole('textbox', { name: '名称', exact: true }).fill('Named request');
  await assertAccessible(page, '[role="dialog"]');
  await creation.getByRole('button', { name: '创建', exact: true }).click();
  await expect(creation).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Named request', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: '过滤接口...', exact: true }).fill('missing request');
  await expect(page.getByText('没有匹配「missing request」的接口', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '清除搜索', exact: true }).click();
  await expect(page.getByRole('row', { name: 'GET Named request', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '删除', exact: true }).click();
  const deletion = page.getByRole('alertdialog', { name: '确认删除', exact: true });
  await assertAccessible(page, '[role="alertdialog"]');
  await deletion.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('row', { name: 'GET Named request', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '任务', exact: true }).click();
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page.getByRole('textbox', { name: '任务名称', exact: true }).fill('Configured task');
  const schedule = page.getByRole('textbox', { name: '调度频率 (Cron 或间隔)', exact: true });
  await schedule.fill('invalid schedule');
  await schedule.press('Tab');
  await expect(page.getByRole('button', { name: '保存任务', exact: true })).toBeDisabled();
  await expect(
    page.getByText('请输入有效的五段 Cron 或正数间隔（ms、s、m、h、d）。', { exact: true }),
  ).toBeVisible();
  await schedule.fill('5m');
  await page.getByRole('button', { name: '保存任务', exact: true }).click();
  const task = page.getByRole('group', { name: 'Configured task', exact: true });
  await expect(task).toBeVisible();
  await expect(task.getByRole('switch', { name: '状态', exact: true })).toBeDisabled();
  await task.getByRole('button', { name: '删除任务', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: '确认删除', exact: true })
    .getByRole('button', { name: '删除', exact: true })
    .click();
  await expect(task).toHaveCount(0);
});

for (const width of [390, 768, 1024, 1440, 1920, 2560]) {
  test(`responsive composition and overlay accessibility at ${width}px`, async ({ page }) => {
    await openWorkbench(page, width, width < 768 ? 844 : 1080);
    await selectRequest(page, 'POST 模拟登录认证 (POST)');
    await page
      .getByRole('tablist', { name: '查询参数', exact: true })
      .getByRole('tab', { name: /^请求头/ })
      .click();
    for (const label of ['参数名', '参数值', '说明']) {
      const box = await page.getByRole('textbox', { name: label, exact: true }).boundingBox();
      expect(box?.width).toBeGreaterThan(100);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await assertAccessible(page);
    await page.getByRole('button', { name: '管理环境', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: '环境变量与全局变量管理', exact: true });
    await expect(drawer).toBeVisible();
    await assertAccessible(page, '[role="dialog"]');
    await drawer.press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole('button', { name: '管理环境', exact: true })).toBeFocused();
    await page.screenshot({
      path: `test-results/api-workbench-ux/${width}-light.png`,
      fullPage: true,
    });
  });
}

test('dark English layout, keyboard collection navigation and floating layer bounds', async ({
  page,
}) => {
  await openWorkbench(page, 1440, 1000);
  await page.getByRole('button', { name: '切换语言', exact: true }).click();
  await page.getByRole('button', { name: 'Switch theme', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'API Workbench', exact: true })).toBeVisible();
  const projects = page.getByRole('button', { name: 'Projects and requests', exact: true });
  if (await projects.isVisible()) await projects.click();
  const row = page.getByRole('row', { name: 'GET 获取用户列表 (Mock)', exact: true });
  await row.focus();
  await row.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page
    .getByRole('tablist', { name: 'Params', exact: true })
    .getByRole('tab', { name: 'Auth', exact: true })
    .click();
  await page.getByRole('button', { name: 'No Auth Auth Type', exact: true }).click();
  const listbox = page.getByRole('listbox', { name: 'Auth Type', exact: true });
  const box = await listbox.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(1440);
  await assertAccessible(page, '[role="listbox"]');
  await page.keyboard.press('Escape');
  await assertAccessible(page);
  await page.screenshot({
    path: test.info().outputPath('test-results/api-workbench-ux/1440-dark-english.png'),
    fullPage: true,
  });
});

test('history restores full request configuration as a separate request without overwriting source drafts', async ({
  page,
}) => {
  await openWorkbench(page);
  const url = page.getByRole('textbox', { name: '请求 URL', exact: true });
  await selectRequest(page, 'POST 模拟登录认证 (POST)');
  await url.fill('mock://auth/login');
  await page.getByRole('tab', { name: '请求体', exact: true }).click();
  await page.getByRole('textbox', { name: '请求内容', exact: true }).fill('{"history": true}');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '历史', exact: true }).click();
  const beforeRaw = await page.evaluate((key) => localStorage.getItem(key), workspaceKey);
  const beforeParsed: unknown = JSON.parse(beforeRaw ?? '{}');
  const beforeResult = safeParseWorkspaceSnapshot(beforeParsed);
  if (!beforeResult.success) throw new Error('Missing workspace');
  const before = beforeResult.data;
  await url.fill('mock://source-draft');
  await page.getByRole('button', { name: /mock:\/\/auth\/login/ }).click();
  await expect(url).toHaveValue('mock://auth/login');
  await expect(page.getByRole('status').filter({ hasText: '恢复为独立草稿' })).toBeVisible();
  await page.getByRole('tab', { name: '请求体', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '请求内容', exact: true })).toHaveValue(
    '{"history": true}',
  );
  await selectRequest(page, 'POST 模拟登录认证 (POST)');
  await expect(url).toHaveValue('mock://source-draft');
  await page.getByRole('button', { name: '工作区', exact: true }).click();
  await page.getByRole('menuitem', { name: /^历史 ·/ }).click();
  await expect(url).toHaveValue('mock://auth/login');
  await page.screenshot({
    path: test.info().outputPath('history-draft.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  const afterRaw = await page.evaluate((key) => localStorage.getItem(key), workspaceKey);
  const afterParsed: unknown = JSON.parse(afterRaw ?? '{}');
  const afterResult = safeParseWorkspaceSnapshot(afterParsed);
  if (!afterResult.success) throw new Error('Missing saved workspace');
  const after = afterResult.data;
  expect(after.requests).toHaveLength(before.requests.length + 1);
  expect(after.requests.slice(0, before.requests.length)).toEqual(before.requests);
  await selectRequest(page, 'POST 模拟登录认证 (POST)');
  await expect(url).toHaveValue('mock://source-draft');
});
