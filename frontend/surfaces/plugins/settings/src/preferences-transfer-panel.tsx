'use client';

/**
 * settings —— 偏好配置输出/导入面板（设置壳页脚，分类页均可用）。
 *
 * - 复制当前配置：`navigator.clipboard.writeText` + Feedback 成功/失败反馈；
 * - 下载 JSON：Blob + anchor 既有写法（不新增依赖）；
 * - 导入配置：DialogSurface + TextAreaField，解析失败逐条列出 issue，确认后按
 *   “真正变化的分类”逐个 `updateCategory`；部分分类写入失败时如实上报（转交设置壳
 *   统一 notSaved 横幅），不宣称整体成功。
 *
 * 注：解析/校验是纯模型（`preferences-transfer.ts`），本组件只负责浏览器能力与呈现。
 */

import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { usePreferencesPort, type PersistResult } from '@clouddrive/plugin-framework/preferences';
import type { Preferences } from '@clouddrive/surface/preferences-model';
import { Action } from '@clouddrive/ui-adapter/action';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { TextAreaField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { Copy, Download } from 'lucide-react';

import {
  changedPreferenceCategories,
  importedPreferencesFieldPath,
  importedPreferencesIssueCode,
  parseImportedPreferences,
  serializePreferences,
} from './preferences-transfer';
import { useSettingsPreferences } from './settings-hooks';

/** issue code → i18n key（`field:*` 走 `issueInvalidField`，路径作为技术标识直出）。 */
const ISSUE_CODE_LABEL_KEY: Readonly<Record<string, string>> = {
  'invalid-json': 'settings.transfer.issues.invalidJson',
  empty: 'settings.transfer.issues.empty',
  'future-version': 'settings.transfer.issues.futureVersion',
  'missing-preferences': 'settings.transfer.issues.missingPreferences',
  'not-object': 'settings.transfer.issues.notObject',
  'unsupported-version': 'settings.transfer.issues.unsupportedVersion',
  'wrong-kind': 'settings.transfer.issues.wrongKind',
};

const ISSUE_FALLBACK_LABEL_KEY = 'settings.transfer.issues.unknown';

export function PreferencesTransferPanel({
  onResult,
}: Readonly<{
  /** 导入写入结果上报给设置壳（统一失败横幅/重试呈现）。 */
  onResult?: (result: PersistResult) => void;
}>) {
  const { t } = useFrontendTranslation();
  const { notify } = useFeedback();
  const port = usePreferencesPort<Preferences>();
  const prefs = useSettingsPreferences();
  const [importText, setImportText] = useState('');
  const [issues, setIssues] = useState<readonly string[]>([]);

  const copyCurrent = async () => {
    const text = serializePreferences(prefs);
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) throw new Error('unavailable');
      await navigator.clipboard.writeText(text);
      notify({ title: t('settings.transfer.copySuccess'), tone: 'success' });
    } catch {
      notify({
        title: t('settings.transfer.copyFailure'),
        description: t('settings.transfer.copyFailureDescription'),
        tone: 'warning',
      });
    }
  };

  const downloadCurrent = () => {
    const blob = new Blob([serializePreferences(prefs)], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.download = `clouddrive-preferences-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.href = downloadUrl;
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
    notify({ title: t('settings.transfer.downloadSuccess'), tone: 'success' });
  };

  const issueLabel = (issue: string): string => {
    const fieldPath = importedPreferencesFieldPath(issue);
    if (fieldPath !== null) return t('settings.transfer.issues.invalidField', { field: fieldPath });
    const code = importedPreferencesIssueCode(issue);
    const labelKey = code ? ISSUE_CODE_LABEL_KEY[code] : undefined;
    return t(labelKey ?? ISSUE_FALLBACK_LABEL_KEY);
  };

  const applyImport = () => {
    const parsed = parseImportedPreferences(importText);
    if (!parsed.ok) {
      setIssues(parsed.issues);
      // 抛出以保持对话框打开（DialogSurface 捕获后显示失败态），当前设置不被修改。
      throw new Error(parsed.issues.join(','));
    }

    const changed = changedPreferenceCategories(prefs, parsed.value);
    setIssues([]);
    setImportText('');

    if (changed.length === 0) {
      notify({ title: t('settings.transfer.importNoChange'), tone: 'info' });
      return;
    }

    const failures: PersistResult[] = [];
    for (const category of changed) {
      const result = port.updateCategory(category, parsed.value[category]);
      if (!result.ok) failures.push(result);
    }

    if (failures.length > 0) {
      const firstFailure = failures[0];
      if (firstFailure) onResult?.(firstFailure);
      notify({
        title: t('settings.transfer.importPartial', {
          count: failures.length,
          total: changed.length,
        }),
        tone: 'warning',
      });
      return;
    }

    notify({
      title: t('settings.transfer.importDone', { count: changed.length }),
      tone: 'success',
    });
  };

  return (
    <div className="grid min-w-0 gap-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{t('settings.transfer.title')}</p>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          {t('settings.transfer.description')}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Action
          leadingIcon={<Copy className="size-3.5" />}
          variant="secondary"
          onPress={() => {
            void copyCurrent();
          }}
        >
          {t('settings.transfer.copy')}
        </Action>
        <Action
          leadingIcon={<Download className="size-3.5" />}
          variant="secondary"
          onPress={downloadCurrent}
        >
          {t('settings.transfer.download')}
        </Action>
        <DialogSurface
          cancelLabel={t('settings.cancel')}
          confirmLabel={t('settings.transfer.importConfirm')}
          description={t('settings.transfer.importDescription')}
          failureMessage={t('settings.transfer.importInvalid')}
          title={t('settings.transfer.importTitle')}
          triggerLabel={t('settings.transfer.import')}
          onConfirm={applyImport}
        >
          <div className="grid min-w-0 gap-4">
            <TextAreaField
              content="code"
              hint={t('settings.transfer.importHint')}
              label={t('settings.transfer.importLabel')}
              placeholder={t('settings.transfer.importPlaceholder')}
              rows={8}
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value);
                setIssues([]);
              }}
            />
            {issues.length > 0 ? (
              <div
                className="rounded-control border border-danger/35 bg-danger-soft p-3 text-sm text-danger"
                role="alert"
              >
                <p className="font-semibold">{t('settings.transfer.importInvalidDescription')}</p>
                <ul className="mt-2 grid gap-1 text-xs leading-5">
                  {issues.map((issue) => (
                    <li key={issue}>{issueLabel(issue)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </DialogSurface>
      </div>
    </div>
  );
}
