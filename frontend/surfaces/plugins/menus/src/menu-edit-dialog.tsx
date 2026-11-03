'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { SwitchField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useRef, useState } from 'react';

import { useMenuOverride, useMenuOverlayStore } from '../stores/menu-overrides';
import {
  validateMenuOverrideDraft,
  type MenuOverride,
  type MenuOverrideDraft,
  type MenuOverrideIssues,
} from './menu-overlay';

const toDraft = (override: MenuOverride | undefined): MenuOverrideDraft => ({
  label: override?.label ?? '',
  permission: override?.permission ?? '',
  order: override?.order === undefined ? '' : String(override.order),
  hidden: override?.hidden ?? false,
});

const toInvalidMessageKey = (reason: string) =>
  reason === 'label-length'
    ? 'menus.validation.label'
    : reason === 'permission-format'
      ? 'menus.validation.permission'
      : 'menus.validation.order';

/**
 * 单个菜单的展示元数据编辑对话框。
 *
 * 只写业务覆盖（标题/排序/可见性/权限标识）；路由与组件由部署期注册表提供，
 * 对话框内不可修改。乐观并发：冲突时重新载入最新值并保留对话框，提示再次确认。
 */
export function MenuEditDialog({
  routeId,
  version,
  override,
}: Readonly<{
  routeId: string;
  version: number;
  override: MenuOverride | undefined;
}>) {
  const { t } = useFrontendTranslation();
  const { notify } = useFeedback();
  const update = useMenuOverlayStore((state) => state.update);
  const latestOverride = useMenuOverride(routeId);
  const [draft, setDraft] = useState<MenuOverrideDraft>(() => toDraft(override));
  const [issues, setIssues] = useState<MenuOverrideIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const expectedVersion = useRef(version);
  const labelRef = useRef<HTMLInputElement | null>(null);
  const permissionRef = useRef<HTMLInputElement | null>(null);
  const orderRef = useRef<HTMLInputElement | null>(null);

  const patchDraft = (patch: Partial<MenuOverrideDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const loadLatest = () => {
    const latest = latestOverride;
    const next = toDraft(latest);
    expectedVersion.current = latest?.version ?? 0;
    setDraft(next);
  };

  const submit = () => {
    const validation = validateMenuOverrideDraft(draft);
    if (!validation.ok) {
      setIssues(validation.issues);
      setFailure(t('menus.dialog.validationFailure'));
      if (validation.issues.label !== undefined) labelRef.current?.focus();
      else if (validation.issues.permission !== undefined) permissionRef.current?.focus();
      else orderRef.current?.focus();
      throw new Error('menus: invalid menu override');
    }
    setIssues({});
    const result = update(routeId, validation.values, expectedVersion.current);
    if (!result.ok) {
      if (result.code === 'conflict') {
        loadLatest();
        setFailure(t('menus.conflict'));
      } else if (result.code === 'readonly') {
        setFailure(t('menus.readonlyDescription'));
      } else {
        setFailure(t(toInvalidMessageKey(result.reason)));
      }
      throw new Error(`menus: ${result.code}`);
    }
    expectedVersion.current += 1;
    setFailure(null);
    notify({ title: t('menus.saveSuccess'), tone: 'success' });
  };

  return (
    <DialogSurface
      triggerLabel={t('menus.actions.edit')}
      title={t('menus.dialog.title')}
      description={t('menus.dialog.description')}
      cancelLabel={t('menus.dialog.cancel')}
      confirmLabel={t('menus.dialog.save')}
      {...(failure !== null ? { failureMessage: failure } : {})}
      onConfirm={submit}
    >
      <div className="grid gap-4">
        <TextField
          ref={labelRef}
          label={t('menus.dialog.label')}
          hint={t('menus.dialog.labelHint')}
          value={draft.label}
          onChange={(event) => patchDraft({ label: event.target.value })}
          {...(issues.label !== undefined ? { error: t('menus.validation.label') } : {})}
        />
        <TextField
          ref={permissionRef}
          label={t('menus.dialog.permission')}
          hint={t('menus.dialog.permissionHint')}
          value={draft.permission}
          onChange={(event) => patchDraft({ permission: event.target.value })}
          {...(issues.permission !== undefined ? { error: t('menus.validation.permission') } : {})}
        />
        <TextField
          ref={orderRef}
          label={t('menus.dialog.order')}
          hint={t('menus.dialog.orderHint')}
          value={draft.order}
          onChange={(event) => patchDraft({ order: event.target.value })}
          {...(issues.order !== undefined ? { error: t('menus.validation.order') } : {})}
        />
        <SwitchField
          presentation="row"
          label={t('menus.dialog.visibility')}
          description={t('menus.dialog.visibilityDescription')}
          checked={draft.hidden}
          onCheckedChange={(hidden) => patchDraft({ hidden })}
        />
      </div>
    </DialogSurface>
  );
}
