'use client';
import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { SectionBody } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { DataTable } from '@clouddrive/ui-adapter/data-display';
import {
  CheckboxField,
  SelectField,
  TextAreaField,
  TextField,
} from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { ManagedPropertyInput } from '../../../src/files/managed-property-input';
import { FilesError } from '../../../src/files/model';
import {
  initialManagedPropertyValue,
  propertyDefinitionLimit,
  propertyKeyPattern,
  propertyKinds,
  propertyRatingLimit,
  validateManagedProperty,
  type PropertyDefinition,
  type PropertyDefinitionsView,
  type PropertyKind,
} from '../../../src/files/property-definitions';
import { useFiles } from '../../../src/files/runtime';
import { CatalogFailure } from './catalog-failure';
import { useCatalogRequest } from './use-catalog-request';

const zh = {
  title: '自定义属性',
  hint: '定义可在文件和目录属性中选用的字段。',
  add: '添加属性',
  edit: '编辑属性',
  remove: '移除定义',
  removeHint: '已保存的文件属性值会保留，之后可作为普通属性使用。',
  empty: '暂无全局属性定义',
  readonly: '当前账号只有查看权限。',
  key: '标识',
  name: '名称',
  kind: '类型',
  action: '操作',
  minimum: '最小值',
  maximum: '最大值',
  minimumText: '最小长度',
  maximumText: '最大长度',
  options: '选项（每行一项）',
  defaultEnabled: '设置默认值',
  defaultValue: '默认值',
  invalid: '请检查标识、范围、选项和默认值。',
  failure: '保存失败，请核对输入。',
  conflict: '定义已被其他操作修改。请刷新后重试。',
  saved: '属性定义已保存。',
  kinds: {
    text: '文本',
    number: '数字',
    checkbox: '勾选',
    select: '单选',
    'multi-select': '多选',
    link: '链接',
    rating: '评分',
  },
};
const en: typeof zh = {
  title: 'Custom properties',
  hint: 'Define reusable fields for file and folder properties.',
  add: 'Add property',
  edit: 'Edit property',
  remove: 'Remove definition',
  removeHint: 'Saved values remain on files and can be edited as ordinary properties.',
  empty: 'No global property definitions',
  readonly: 'Your account has read-only access.',
  key: 'Identifier',
  name: 'Name',
  kind: 'Type',
  action: 'Actions',
  minimum: 'Minimum value',
  maximum: 'Maximum value',
  minimumText: 'Minimum length',
  maximumText: 'Maximum length',
  options: 'Options (one per line)',
  defaultEnabled: 'Set a default value',
  defaultValue: 'Default value',
  invalid: 'Check the identifier, bounds, choices, and default value.',
  failure: 'Could not save the definition.',
  conflict: 'The definitions changed elsewhere. Refresh and try again.',
  saved: 'Property definitions saved.',
  kinds: {
    text: 'Text',
    number: 'Number',
    checkbox: 'Checkbox',
    select: 'Single choice',
    'multi-select': 'Multiple choices',
    link: 'Link',
    rating: 'Rating',
  },
};

type PropertyDefinitionRow = PropertyDefinition & { id: string };

type Draft = {
  key: string;
  name: string;
  kind: PropertyKind;
  minimum: string;
  maximum: string;
  options: string;
  hasDefault: boolean;
  defaultValue: string;
};

function newDraft(definition?: PropertyDefinition): Draft {
  return {
    key: definition?.key ?? '',
    name: definition?.name ?? '',
    kind: definition?.kind ?? 'text',
    minimum: String(definition?.minimum ?? ''),
    maximum: String(definition?.maximum ?? ''),
    options: definition?.options?.join('\n') ?? '',
    hasDefault: definition?.defaultValue !== undefined,
    defaultValue: definition ? initialManagedPropertyValue(definition) : '',
  };
}

function allowsMinimum(kind: PropertyKind) {
  return kind === 'text' || kind === 'number';
}

function hasOptions(kind: PropertyKind) {
  return kind === 'select' || kind === 'multi-select';
}

function parseDefinition(draft: Draft): PropertyDefinition | undefined {
  const definition: PropertyDefinition = {
    key: draft.key.trim(),
    name: draft.name.trim().normalize('NFC'),
    kind: draft.kind,
  };
  if (
    !propertyKeyPattern.test(definition.key) ||
    !definition.name ||
    [...definition.name].length > 64
  )
    return;
  const supportsMinimum = allowsMinimum(draft.kind);
  if (supportsMinimum && draft.minimum !== '') definition.minimum = Number(draft.minimum);
  if ((supportsMinimum || draft.kind === 'rating') && draft.maximum !== '')
    definition.maximum = Number(draft.maximum);
  const bounds = [definition.minimum, definition.maximum].filter((value) => value !== undefined);
  if (
    bounds.some((value) => !Number.isFinite(value)) ||
    (definition.minimum !== undefined &&
      definition.maximum !== undefined &&
      definition.minimum > definition.maximum)
  )
    return;
  if (
    draft.kind === 'text' &&
    bounds.some((value) => !Number.isInteger(value) || value < 0 || value > 256)
  )
    return;
  if (
    draft.kind === 'rating' &&
    bounds.some((value) => !Number.isInteger(value) || value < 1 || value > propertyRatingLimit)
  )
    return;
  if (hasOptions(draft.kind)) {
    definition.options = draft.options
      .split(/\r?\n/)
      .map((option) => option.trim().normalize('NFC'))
      .filter(Boolean);
    if (
      !definition.options.length ||
      definition.options.length > 16 ||
      new Set(definition.options).size !== definition.options.length ||
      definition.options.some((option) => [...option].length > 64)
    )
      return;
  }
  if (draft.hasDefault) {
    definition.defaultValue = draft.defaultValue.normalize('NFC');
    if (!validateManagedProperty(definition, definition.defaultValue)) return;
  }
  return definition;
}

function DefinitionEditor({
  initial,
  existing,
  labels,
  close,
  save,
  failure,
  refresh,
}: {
  initial?: PropertyDefinition;
  existing: readonly PropertyDefinition[];
  labels: typeof zh;
  close: () => void;
  save: (definition: PropertyDefinition) => Promise<void>;
  failure: string;
  refresh: () => void;
}) {
  const { t } = useFrontendTranslation();
  const [draft, setDraft] = useState(() => newDraft(initial));
  const parsed = parseDefinition(draft);
  const conflict = failure === labels.conflict;
  const available =
    parsed &&
    !existing.some(
      (definition) => definition.key === parsed.key && definition.key !== initial?.key,
    );
  const update = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    setDraft({ ...draft, [field]: value });
  const defaults: PropertyDefinition = {
    key: draft.key,
    name: draft.name,
    kind: draft.kind,
    ...(hasOptions(draft.kind)
      ? {
          options: [
            ...new Set(
              draft.options
                .split(/\r?\n/)
                .map((option) => option.trim())
                .filter(Boolean),
            ),
          ].slice(0, 16),
        }
      : {}),
  };
  const ratingMaximum = Number(draft.maximum);
  if (
    draft.kind === 'rating' &&
    Number.isInteger(ratingMaximum) &&
    ratingMaximum >= 1 &&
    ratingMaximum <= propertyRatingLimit
  ) {
    defaults.maximum = ratingMaximum;
  }
  return (
    <DialogSurface
      isOpen
      triggerLabel={labels.add}
      title={initial ? labels.edit : labels.add}
      description={labels.hint}
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.save')}
      confirmDisabled={!available || conflict}
      failureMessage={failure || labels.failure}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      onConfirm={async () => {
        if (available && parsed) await save(parsed);
      }}
    >
      <div className="min-w-0 space-y-4">
        <TextField
          label={labels.key}
          value={draft.key}
          maxLength={64}
          disabled={initial !== undefined}
          onChange={(event) => update('key', event.target.value)}
        />
        <TextField
          label={labels.name}
          value={draft.name}
          maxLength={128}
          onChange={(event) => update('name', event.target.value)}
        />
        <SelectField
          label={labels.kind}
          value={draft.kind}
          disabled={initial !== undefined}
          options={propertyKinds.map((kind) => ({
            value: kind,
            label: labels.kinds[kind],
          }))}
          onValueChange={(value) => {
            const kind = propertyKinds.find((candidate) => candidate === value);
            if (kind)
              setDraft({
                ...newDraft(),
                key: draft.key,
                name: draft.name,
                kind,
                defaultValue: initialManagedPropertyValue({ kind }),
              });
          }}
        />
        {allowsMinimum(draft.kind) ? (
          <TextField
            label={draft.kind === 'text' ? labels.minimumText : labels.minimum}
            value={draft.minimum}
            onChange={(event) => update('minimum', event.target.value)}
          />
        ) : null}
        {allowsMinimum(draft.kind) || draft.kind === 'rating' ? (
          <TextField
            label={draft.kind === 'text' ? labels.maximumText : labels.maximum}
            value={draft.maximum}
            onChange={(event) => update('maximum', event.target.value)}
          />
        ) : null}
        {hasOptions(draft.kind) ? (
          <TextAreaField
            label={labels.options}
            value={draft.options}
            rows={3}
            onChange={(event) => update('options', event.target.value)}
          />
        ) : null}
        <CheckboxField
          label={labels.defaultEnabled}
          checked={draft.hasDefault}
          onCheckedChange={(value) => update('hasDefault', value)}
        />
        {draft.hasDefault ? (
          <ManagedPropertyInput
            definition={defaults}
            label={labels.defaultValue}
            value={draft.defaultValue}
            onChange={(value) => update('defaultValue', value)}
          />
        ) : null}
        {draft.key && draft.name && !available ? <p role="status">{labels.invalid}</p> : null}
        {conflict ? (
          <Action variant="secondary" onPress={refresh}>
            {t('files.refresh')}
          </Action>
        ) : null}
      </div>
    </DialogSurface>
  );
}

function DefinitionsTable({
  initial,
  labels,
  refresh,
}: {
  initial: PropertyDefinitionsView;
  labels: typeof zh;
  refresh: () => void;
}) {
  const files = useFiles();
  const { t } = useFrontendTranslation();
  const [view, setView] = useState(initial);
  const [editor, setEditor] = useState<{ original?: PropertyDefinition }>();
  const [removal, setRemoval] = useState<PropertyDefinition>();
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState(false);
  const begin = (value: { original?: PropertyDefinition }) => {
    setFailure('');
    setNotice(false);
    setEditor(value);
  };
  const save = async (items: PropertyDefinition[]) => {
    try {
      setView(await files.savePropertyDefinitions({ revision: view.revision, items }));
      setNotice(true);
    } catch (error) {
      setFailure(
        error instanceof FilesError && error.code === 'conflict' ? labels.conflict : labels.failure,
      );
      throw error;
    }
  };
  return (
    <>
      <div className="flex flex-wrap justify-between gap-2">
        <p>{labels.hint}</p>
        <div className="flex flex-wrap gap-2">
          <Action variant="secondary" onPress={refresh}>
            {t('files.refresh')}
          </Action>
          {view.canSave ? (
            <Action
              onPress={() => begin({})}
              disabled={view.items.length >= propertyDefinitionLimit}
            >
              {labels.add}
            </Action>
          ) : null}
        </div>
      </div>
      {!view.canSave ? <p>{labels.readonly}</p> : null}
      {notice ? <p role="status">{labels.saved}</p> : null}
      <DataTable<PropertyDefinitionRow>
        label={labels.title}
        density="compact"
        rows={view.items.map((row) => ({ ...row, id: row.key }))}
        emptyContent={labels.empty}
        columns={[
          {
            id: 'name',
            label: labels.name,
            rowHeader: true,
            render: (row) => row.name,
          },
          { id: 'key', label: labels.key, render: (row) => row.key },
          {
            id: 'kind',
            label: labels.kind,
            render: (row) => labels.kinds[row.kind],
          },
          ...(view.canSave
            ? [
                {
                  id: 'action',
                  label: labels.action,
                  render: (row: PropertyDefinition) => (
                    <div className="flex flex-wrap gap-2">
                      <Action size="sm" variant="quiet" onPress={() => begin({ original: row })}>
                        {labels.edit}
                      </Action>
                      <Action
                        size="sm"
                        variant="quiet"
                        onPress={() => {
                          setFailure('');
                          setRemoval(row);
                        }}
                      >
                        {labels.remove}
                      </Action>
                    </div>
                  ),
                },
              ]
            : []),
        ]}
      />
      {editor ? (
        <DefinitionEditor
          {...(editor.original ? { initial: editor.original } : {})}
          existing={view.items}
          labels={labels}
          close={() => setEditor(undefined)}
          refresh={refresh}
          failure={failure}
          save={(definition) =>
            save(
              editor.original
                ? view.items.map((row) => (row.key === editor.original?.key ? definition : row))
                : [...view.items, definition],
            )
          }
        />
      ) : null}
      {removal ? (
        <DialogSurface
          isOpen
          triggerLabel={labels.remove}
          title={labels.remove}
          description={labels.removeHint}
          cancelLabel={t('files.cancel')}
          confirmLabel={labels.remove}
          failureMessage={failure || labels.failure}
          confirmDisabled={failure === labels.conflict}
          onOpenChange={(open) => {
            if (!open) setRemoval(undefined);
          }}
          onConfirm={() => save(view.items.filter((row) => row.key !== removal.key))}
        >
          <p className="break-all">{removal.name}</p>
          {failure === labels.conflict ? (
            <Action variant="secondary" onPress={refresh}>
              {t('files.refresh')}
            </Action>
          ) : null}
        </DialogSurface>
      ) : null}
    </>
  );
}

export function PropertyDefinitionsPanel() {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const state = useCatalogRequest(
    useCallback((signal) => files.readPropertyDefinitions(signal), [files]),
  );
  return (
    <Panel className="surface-route-region overflow-hidden">
      <SectionBody>
        {!state.result ? <p role="status">{t('administration.loading')}</p> : null}
        {state.result && 'error' in state.result ? (
          <CatalogFailure error={state.result.error} retry={state.refresh} />
        ) : null}
        {state.result && 'value' in state.result ? (
          <DefinitionsTable initial={state.result.value} labels={labels} refresh={state.refresh} />
        ) : null}
      </SectionBody>
    </Panel>
  );
}
