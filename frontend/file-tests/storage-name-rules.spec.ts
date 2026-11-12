import { expect, test } from '@playwright/test';
import type { StorageNameRulesView } from '../surfaces/src/files/storage-policy';
import { loginStorage, storageRequest, storageSection } from './storage-fixture';

test('名称规则在独立窗口试测，输入变化取消旧结果并保存待生效摘要', async ({ page }, info) => {
  test.skip(!process.env.CLOUDDRIVE_FILE_TEST_ACCESS, '写入只使用显式指定的隔离预览。');
  await loginStorage(page);
  const initial = await storageRequest<StorageNameRulesView>(page, '/name-rules');
  const section = storageSection(page, '上传名称规则');
  try {
    await section.getByRole('button', { name: '编辑名称规则', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '编辑名称规则', exact: true });
    const mode = dialog.getByRole('button', { name: /扩展名规则$/ });
    await mode.click();
    await page.getByRole('option', { name: '允许匹配', exact: true }).click();
    await dialog.getByRole('textbox', { name: '文件扩展名', exact: true }).fill('txt, MD');
    await dialog.getByRole('textbox', { name: '文件名正则', exact: true }).fill('');
    const sample = dialog.getByRole('textbox', { name: '试测文件名', exact: true });
    const trial = dialog.getByRole('button', { name: '测试名称', exact: true });
    await sample.fill('blocked.bin');
    await trial.click();
    await expect(dialog.getByText('被扩展名规则拒绝', { exact: true })).toBeVisible();
    await sample.fill('accepted.TXT');
    await expect(dialog.getByText('被扩展名规则拒绝', { exact: true })).toHaveCount(0);
    await trial.click();
    await expect(dialog.getByText('通过当前输入的规则', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 800 });
    await expect
      .poll(() => dialog.evaluate((element) => element.scrollWidth <= element.clientWidth))
      .toBe(true);
    await page.screenshot({ path: info.outputPath('storage-name-rules-mobile.png') });
    await dialog.getByRole('button', { name: '保存规则', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const saved = await storageRequest<StorageNameRulesView>(page, '/name-rules');
    expect(saved.rules.extensions).toEqual(['md', 'txt']);
    expect(saved.active).toEqual(initial.active);
    await expect(section).toContainText('已保存，等待服务重启');
    await expect(section.getByRole('heading', { name: '下次启动', exact: true })).toBeVisible();
    await expect(section).toContainText('md, txt');
    await page.reload();
    await expect(section).toContainText('md, txt');
  } finally {
    const latest = await storageRequest<StorageNameRulesView>(page, '/name-rules');
    await storageRequest(page, '/name-rules', 'PUT', {
      revision: latest.revision,
      rules: initial.rules,
    });
  }
});
