'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { usePreferencesPort, type PersistResult } from '@clouddrive/plugin-framework/preferences';
import type { Preferences } from '@clouddrive/surface/preferences-model';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';

/**
 * 恢复默认（双层）：
 * - `RestoreAllButton`：恢复全部九分类（ConfirmDialog 二次确认，列影响范围）；
 * - `RestoreCategoryButton`：恢复单分类（ConfirmDialog，只影响该分类）。
 * 只恢复偏好；不触碰账号/业务数据、收藏、最近、通知、草稿与已保存筛选方案
 * （resetCategory/resetAll 由 Host Port 保证只写偏好 store）。
 * 恢复失败（PersistResult 非 ok）经 onResult 上报（设置页统一呈现 notSaved）。
 */
type Props = {
  /** 恢复结果上报给父级（设置页统一呈现失败/重试）。 */
  onResult?: (result: PersistResult) => void;
};

export function RestoreAllButton({ onResult }: Props) {
  const { t } = useFrontendTranslation();
  const port = usePreferencesPort<Preferences>();
  return (
    <ConfirmDialog
      cancelLabel={t('settings.cancel')}
      confirmLabel={t('settings.confirmRestore')}
      description={t('settings.restoreAllDescription')}
      failureMessage={t('settings.notSaved')}
      impact={t('settings.restoreImpact')}
      title={t('settings.restoreAllTitle')}
      triggerLabel={t('settings.restoreAll')}
      onConfirm={() => {
        const result = port.resetAll();
        onResult?.(result);
      }}
    />
  );
}

export function RestoreCategoryButton({
  category,
  categoryLabel,
  onResult,
}: Props & { category: keyof Preferences; categoryLabel: string }) {
  const { t } = useFrontendTranslation();
  const port = usePreferencesPort<Preferences>();
  return (
    <ConfirmDialog
      cancelLabel={t('settings.cancel')}
      confirmLabel={t('settings.confirmRestore')}
      description={t('settings.restoreCategoryDescription')}
      failureMessage={t('settings.notSaved')}
      impact={categoryLabel}
      title={t('settings.restoreCategoryTitle', { category: categoryLabel })}
      triggerLabel={t('settings.restoreCategory')}
      onConfirm={() => {
        const result = port.resetCategory(category);
        onResult?.(result);
      }}
    />
  );
}
