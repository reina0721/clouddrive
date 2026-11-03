'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { SelectField, TextAreaField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useMemo, useRef, useState } from 'react';

import { useDepartmentsStore } from '../stores/departments';
import {
  departmentParentOptions,
  validateDepartmentDraft,
  type DepartmentDraft,
  type DepartmentIssues,
  type DepartmentNode,
} from './department-model';

type DialogMode = 'create' | 'edit';

const toDraft = (node: DepartmentNode | undefined, parentId: string | null): DepartmentDraft => ({
  name: node?.name ?? '',
  leader: node?.leader ?? '',
  remark: node?.remark ?? '',
  status: node?.status ?? 'active',
  parentId: node?.parentId ?? parentId ?? '',
});

const issueMessageKey = (reason: string): string => {
  switch (reason) {
    case 'name-length':
      return 'departments.validation.name';
    case 'leader-length':
      return 'departments.validation.leader';
    case 'remark-length':
      return 'departments.validation.remark';
    case 'parent-depth':
      return 'departments.validation.parentDepth';
    case 'parent-invalid':
      return 'departments.validation.parent';
    case 'has-children':
      return 'departments.deleteBlocked.children';
    case 'has-members':
      return 'departments.deleteBlocked.members';
    default:
      return 'departments.dialog.failure';
  }
};

/**
 * 部门新增 / 修改对话框。
 *
 * - 上级部门选项排除自身与全部下级，并排除会造成超过三级的节点；
 * - 字段校验与 store 使用同一套规则；首个错误字段获得焦点；
 * - 版本冲突时重新载入最新值并保留对话框，让用户确认后再次保存。
 */
export function DepartmentDialog({
  mode,
  triggerLabel,
  nodes,
  node,
  parentId = null,
}: Readonly<{
  mode: DialogMode;
  triggerLabel: string;
  nodes: readonly DepartmentNode[];
  node?: DepartmentNode;
  parentId?: string | null;
}>) {
  const { t } = useFrontendTranslation();
  const { notify } = useFeedback();
  const create = useDepartmentsStore((state) => state.create);
  const update = useDepartmentsStore((state) => state.update);
  const [draft, setDraft] = useState<DepartmentDraft>(() => toDraft(node, parentId));
  const [issues, setIssues] = useState<DepartmentIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const expectedVersion = useRef(node?.version ?? 0);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const leaderRef = useRef<HTMLInputElement | null>(null);
  const remarkRef = useRef<HTMLTextAreaElement | null>(null);

  const parentOptions = useMemo(
    () => departmentParentOptions(nodes, mode === 'edit' ? (node?.id ?? null) : null),
    [mode, node?.id, nodes],
  );

  const patchDraft = (patch: Partial<DepartmentDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const reloadLatest = () => {
    const id = node?.id;
    if (id === undefined) return;
    const latest = useDepartmentsStore.getState().nodes.find((item) => item.id === id);
    if (latest === undefined) return;
    const next = toDraft(latest, parentId);
    expectedVersion.current = latest.version;
    setDraft(next);
  };

  const submit = () => {
    const subjectId = mode === 'edit' ? (node?.id ?? null) : null;
    const validation = validateDepartmentDraft(nodes, subjectId, draft);
    if (!validation.ok) {
      setIssues(validation.issues);
      setFailure(t('departments.dialog.validationFailure'));
      if (validation.issues.name !== undefined) nameRef.current?.focus();
      else if (validation.issues.leader !== undefined) leaderRef.current?.focus();
      else if (validation.issues.remark !== undefined) remarkRef.current?.focus();
      throw new Error('departments: invalid department');
    }
    setIssues({});
    const result =
      mode === 'edit' && node !== undefined
        ? update(node.id, draft, expectedVersion.current)
        : create(draft);
    if (!result.ok) {
      if (result.code === 'conflict') {
        reloadLatest();
        setFailure(t('departments.conflict'));
      } else if (result.code === 'readonly') {
        setFailure(t('departments.readonlyDescription'));
      } else {
        setFailure(t(issueMessageKey(result.reason)));
      }
      throw new Error(`departments: ${result.code}`);
    }
    if (mode === 'edit') {
      expectedVersion.current += 1;
    } else {
      setDraft(toDraft(undefined, parentId));
    }
    setFailure(null);
    notify({
      title: t(mode === 'edit' ? 'departments.saveSuccess' : 'departments.createSuccess'),
      tone: 'success',
    });
  };

  return (
    <DialogSurface
      triggerLabel={triggerLabel}
      title={t(mode === 'edit' ? 'departments.dialog.editTitle' : 'departments.dialog.createTitle')}
      description={t('departments.dialog.description')}
      cancelLabel={t('departments.dialog.cancel')}
      confirmLabel={t(mode === 'edit' ? 'departments.dialog.save' : 'departments.dialog.create')}
      {...(failure !== null ? { failureMessage: failure } : {})}
      onConfirm={submit}
    >
      <div className="grid gap-4">
        <TextField
          ref={nameRef}
          label={t('departments.dialog.name')}
          hint={t('departments.dialog.nameHint')}
          value={draft.name}
          onChange={(event) => patchDraft({ name: event.target.value })}
          {...(issues.name !== undefined ? { error: t('departments.validation.name') } : {})}
        />
        <SelectField
          label={t('departments.dialog.parent')}
          value={draft.parentId}
          onValueChange={(value) => patchDraft({ parentId: value })}
          options={[
            { value: '', label: t('departments.dialog.parentRoot') },
            ...parentOptions.map((option) => ({
              value: option.id,
              label: option.name,
              description: option.description,
            })),
          ]}
          {...(issues.parent !== undefined
            ? {
                error: t(
                  issues.parent === 'parent-depth'
                    ? 'departments.validation.parentDepth'
                    : 'departments.validation.parent',
                ),
              }
            : {})}
        />
        <TextField
          ref={leaderRef}
          label={t('departments.dialog.leader')}
          hint={t('departments.dialog.leaderHint')}
          value={draft.leader}
          onChange={(event) => patchDraft({ leader: event.target.value })}
          {...(issues.leader !== undefined ? { error: t('departments.validation.leader') } : {})}
        />
        <SelectField
          label={t('departments.dialog.status')}
          value={draft.status}
          onValueChange={(value) => {
            if (value === 'active' || value === 'disabled') {
              patchDraft({ status: value });
            }
          }}
          options={[
            { value: 'active', label: t('departments.status.active') },
            { value: 'disabled', label: t('departments.status.disabled') },
          ]}
        />
        <TextAreaField
          ref={remarkRef}
          label={t('departments.dialog.remark')}
          hint={t('departments.dialog.remarkHint')}
          rows={3}
          value={draft.remark}
          onChange={(event) => patchDraft({ remark: event.target.value })}
          {...(issues.remark !== undefined ? { error: t('departments.validation.remark') } : {})}
        />
      </div>
    </DialogSurface>
  );
}
