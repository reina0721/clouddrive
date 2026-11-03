'use client';

import { useFrontendTranslation } from '@clouddrive/i18n';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { SelectField, TextAreaField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useRef, useState } from 'react';

import { useDictionariesStore } from '../stores/dictionaries';
import {
  dictionaryTones,
  isDictionaryCodeAvailable,
  validateDictionaryItemDraft,
  validateDictionaryTypeDraft,
  type DictionaryItem,
  type DictionaryItemDraft,
  type DictionaryItemIssues,
  type DictionaryType,
  type DictionaryTypeDraft,
  type DictionaryTypeIssues,
} from './dictionary-model';

type DialogMode = 'create' | 'edit';

const typeIssueKey = (reason: string): string => {
  switch (reason) {
    case 'name-length':
      return 'dictionaries.validation.name';
    case 'code-format':
      return 'dictionaries.validation.code';
    case 'code-duplicate':
      return 'dictionaries.validation.codeDuplicate';
    case 'remark-length':
      return 'dictionaries.validation.remark';
    default:
      return 'dictionaries.typeDialog.failure';
  }
};

const itemIssueKey = (reason: string): string => {
  switch (reason) {
    case 'label-length':
      return 'dictionaries.validation.label';
    case 'value-length':
      return 'dictionaries.validation.value';
    case 'order-range':
      return 'dictionaries.validation.order';
    default:
      return 'dictionaries.itemDialog.failure';
  }
};

const toTypeDraft = (type: DictionaryType | undefined): DictionaryTypeDraft => ({
  name: type?.name ?? '',
  code: type?.code ?? '',
  status: type?.status ?? 'active',
  remark: type?.remark ?? '',
});

const nextItemOrder = (items: readonly DictionaryItem[], typeId: string): string => {
  const current = items.filter((item) => item.typeId === typeId);
  const max = current.reduce((value, item) => Math.max(value, item.order), -1);
  return String(Math.min(999, max + 1));
};

const toItemDraft = (
  item: DictionaryItem | undefined,
  items: readonly DictionaryItem[],
  typeId: string,
): DictionaryItemDraft => ({
  label: item?.label ?? '',
  value: item?.value ?? '',
  order: item === undefined ? nextItemOrder(items, typeId) : String(item.order),
  status: item?.status ?? 'active',
  tone: item?.tone ?? 'default',
});

/** 字典类型新增 / 修改对话框（编码唯一性内联校验）。 */
export function DictionaryTypeDialog({
  mode,
  triggerLabel,
  types,
  dictionaryType,
  onCreated,
}: Readonly<{
  mode: DialogMode;
  triggerLabel: string;
  types: readonly DictionaryType[];
  dictionaryType?: DictionaryType;
  onCreated?: (typeId: string) => void;
}>) {
  const { t } = useFrontendTranslation();
  const { notify } = useFeedback();
  const createType = useDictionariesStore((state) => state.createType);
  const updateType = useDictionariesStore((state) => state.updateType);
  const [draft, setDraft] = useState<DictionaryTypeDraft>(() => toTypeDraft(dictionaryType));
  const [issues, setIssues] = useState<DictionaryTypeIssues>({});
  const [duplicate, setDuplicate] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const expectedVersion = useRef(dictionaryType?.version ?? 0);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const codeRef = useRef<HTMLInputElement | null>(null);

  const patchDraft = (patch: Partial<DictionaryTypeDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const reloadLatest = () => {
    const id = dictionaryType?.id;
    if (id === undefined) return;
    const latest = useDictionariesStore.getState().types.find((item) => item.id === id);
    if (latest === undefined) return;
    const next = toTypeDraft(latest);
    expectedVersion.current = latest.version;
    setDraft(next);
  };

  const submit = () => {
    const validation = validateDictionaryTypeDraft(draft);
    const codeTaken =
      validation.ok &&
      !isDictionaryCodeAvailable(types, validation.values.code, dictionaryType?.id);
    if (!validation.ok || codeTaken) {
      setIssues(validation.ok ? {} : validation.issues);
      setDuplicate(codeTaken);
      setFailure(t('dictionaries.typeDialog.validationFailure'));
      if (!validation.ok && validation.issues.name !== undefined) nameRef.current?.focus();
      else codeRef.current?.focus();
      throw new Error('dictionaries: invalid type');
    }
    setIssues({});
    setDuplicate(false);
    const result =
      mode === 'edit' && dictionaryType !== undefined
        ? updateType(dictionaryType.id, draft, expectedVersion.current)
        : createType(draft);
    if (!result.ok) {
      if (result.code === 'conflict') {
        reloadLatest();
        setFailure(t('dictionaries.conflict'));
      } else if (result.code === 'readonly') {
        setFailure(t('dictionaries.readonlyDescription'));
      } else {
        if (result.reason === 'code-duplicate') setDuplicate(true);
        setFailure(t(typeIssueKey(result.reason)));
      }
      throw new Error(`dictionaries: ${result.code}`);
    }
    if (mode === 'edit') {
      expectedVersion.current += 1;
    } else {
      setDraft(toTypeDraft(undefined));
    }
    setFailure(null);
    if (mode === 'create' && onCreated !== undefined) {
      const created = useDictionariesStore.getState().types.at(-1);
      if (created !== undefined) onCreated(created.id);
    }
    notify({ title: t('dictionaries.saveSuccess'), tone: 'success' });
  };

  const codeError =
    issues.code !== undefined
      ? t('dictionaries.validation.code')
      : duplicate
        ? t('dictionaries.validation.codeDuplicate')
        : undefined;

  return (
    <DialogSurface
      triggerLabel={triggerLabel}
      title={t(
        mode === 'edit'
          ? 'dictionaries.typeDialog.editTitle'
          : 'dictionaries.typeDialog.createTitle',
      )}
      description={t('dictionaries.typeDialog.description')}
      cancelLabel={t('dictionaries.typeDialog.cancel')}
      confirmLabel={t(
        mode === 'edit' ? 'dictionaries.typeDialog.save' : 'dictionaries.typeDialog.create',
      )}
      {...(failure !== null ? { failureMessage: failure } : {})}
      onConfirm={submit}
    >
      <div className="grid gap-4">
        <TextField
          ref={nameRef}
          label={t('dictionaries.typeDialog.name')}
          hint={t('dictionaries.typeDialog.nameHint')}
          value={draft.name}
          onChange={(event) => patchDraft({ name: event.target.value })}
          {...(issues.name !== undefined ? { error: t('dictionaries.validation.name') } : {})}
        />
        <TextField
          ref={codeRef}
          label={t('dictionaries.typeDialog.code')}
          hint={t('dictionaries.typeDialog.codeHint')}
          value={draft.code}
          onChange={(event) => patchDraft({ code: event.target.value })}
          {...(codeError !== undefined ? { error: codeError } : {})}
        />
        <SelectField
          label={t('dictionaries.typeDialog.status')}
          value={draft.status}
          onValueChange={(value) => {
            if (value === 'active' || value === 'disabled') patchDraft({ status: value });
          }}
          options={[
            { value: 'active', label: t('dictionaries.status.active') },
            { value: 'disabled', label: t('dictionaries.status.disabled') },
          ]}
        />
        <TextAreaField
          label={t('dictionaries.typeDialog.remark')}
          hint={t('dictionaries.typeDialog.remarkHint')}
          rows={3}
          value={draft.remark}
          onChange={(event) => patchDraft({ remark: event.target.value })}
          {...(issues.remark !== undefined ? { error: t('dictionaries.validation.remark') } : {})}
        />
      </div>
    </DialogSurface>
  );
}

/** 字典项新增 / 修改对话框。 */
export function DictionaryItemDialog({
  mode,
  triggerLabel,
  typeId,
  items,
  item,
}: Readonly<{
  mode: DialogMode;
  triggerLabel: string;
  typeId: string;
  items: readonly DictionaryItem[];
  item?: DictionaryItem;
}>) {
  const { t } = useFrontendTranslation();
  const { notify } = useFeedback();
  const createItem = useDictionariesStore((state) => state.createItem);
  const updateItem = useDictionariesStore((state) => state.updateItem);
  const [draft, setDraft] = useState<DictionaryItemDraft>(() => toItemDraft(item, items, typeId));
  const [issues, setIssues] = useState<DictionaryItemIssues>({});
  const [failure, setFailure] = useState<string | null>(null);
  const expectedVersion = useRef(item?.version ?? 0);
  const labelRef = useRef<HTMLInputElement | null>(null);
  const valueRef = useRef<HTMLInputElement | null>(null);
  const orderRef = useRef<HTMLInputElement | null>(null);

  const patchDraft = (patch: Partial<DictionaryItemDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  const reloadLatest = () => {
    const id = item?.id;
    if (id === undefined) return;
    const latest = useDictionariesStore.getState().items.find((entry) => entry.id === id);
    if (latest === undefined) return;
    const next = toItemDraft(latest, items, typeId);
    expectedVersion.current = latest.version;
    setDraft(next);
  };

  const submit = () => {
    const validation = validateDictionaryItemDraft(draft);
    if (!validation.ok) {
      setIssues(validation.issues);
      setFailure(t('dictionaries.itemDialog.validationFailure'));
      if (validation.issues.label !== undefined) labelRef.current?.focus();
      else if (validation.issues.value !== undefined) valueRef.current?.focus();
      else orderRef.current?.focus();
      throw new Error('dictionaries: invalid item');
    }
    setIssues({});
    const result =
      mode === 'edit' && item !== undefined
        ? updateItem(item.id, draft, expectedVersion.current)
        : createItem(typeId, draft);
    if (!result.ok) {
      if (result.code === 'conflict') {
        reloadLatest();
        setFailure(t('dictionaries.conflict'));
      } else if (result.code === 'readonly') {
        setFailure(t('dictionaries.readonlyDescription'));
      } else {
        setFailure(t(itemIssueKey(result.reason)));
      }
      throw new Error(`dictionaries: ${result.code}`);
    }
    if (mode === 'edit') {
      expectedVersion.current += 1;
    } else {
      setDraft(toItemDraft(undefined, items, typeId));
    }
    setFailure(null);
    notify({ title: t('dictionaries.saveSuccess'), tone: 'success' });
  };

  return (
    <DialogSurface
      triggerLabel={triggerLabel}
      title={t(
        mode === 'edit'
          ? 'dictionaries.itemDialog.editTitle'
          : 'dictionaries.itemDialog.createTitle',
      )}
      description={t('dictionaries.itemDialog.description')}
      cancelLabel={t('dictionaries.itemDialog.cancel')}
      confirmLabel={t(
        mode === 'edit' ? 'dictionaries.itemDialog.save' : 'dictionaries.itemDialog.create',
      )}
      {...(failure !== null ? { failureMessage: failure } : {})}
      onConfirm={submit}
    >
      <div className="grid gap-4">
        <TextField
          ref={labelRef}
          label={t('dictionaries.itemDialog.label')}
          hint={t('dictionaries.itemDialog.labelHint')}
          value={draft.label}
          onChange={(event) => patchDraft({ label: event.target.value })}
          {...(issues.label !== undefined ? { error: t('dictionaries.validation.label') } : {})}
        />
        <TextField
          ref={valueRef}
          label={t('dictionaries.itemDialog.value')}
          hint={t('dictionaries.itemDialog.valueHint')}
          value={draft.value}
          onChange={(event) => patchDraft({ value: event.target.value })}
          {...(issues.value !== undefined ? { error: t('dictionaries.validation.value') } : {})}
        />
        <TextField
          ref={orderRef}
          label={t('dictionaries.itemDialog.order')}
          hint={t('dictionaries.itemDialog.orderHint')}
          value={draft.order}
          onChange={(event) => patchDraft({ order: event.target.value })}
          {...(issues.order !== undefined ? { error: t('dictionaries.validation.order') } : {})}
        />
        <SelectField
          label={t('dictionaries.itemDialog.status')}
          value={draft.status}
          onValueChange={(value) => {
            if (value === 'active' || value === 'disabled') patchDraft({ status: value });
          }}
          options={[
            { value: 'active', label: t('dictionaries.status.active') },
            { value: 'disabled', label: t('dictionaries.status.disabled') },
          ]}
        />
        <SelectField
          label={t('dictionaries.itemDialog.tone')}
          value={draft.tone}
          onValueChange={(value) => {
            const tone = dictionaryTones.find((entry) => entry === value);
            if (tone !== undefined) patchDraft({ tone });
          }}
          options={dictionaryTones.map((tone) => ({
            value: tone,
            label: t(`dictionaries.tone.${tone}`),
          }))}
        />
      </div>
    </DialogSurface>
  );
}
