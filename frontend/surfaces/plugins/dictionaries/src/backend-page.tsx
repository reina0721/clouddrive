'use client';
import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Section, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField, SelectField } from '@clouddrive/ui-adapter/form-field';
import { DataTable, type DataColumn } from '@clouddrive/ui-adapter/data-display';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useRequiredAdministration } from '../../../src/administration/context';
import { useRemote, RemoteRegion } from '../../../src/administration/resource-state';
import type { Dictionary, DictionaryItem } from '../../../src/administration/model';

function DictionaryEditor({
  dictionary,
  entry,
  parent,
  onSaved,
}: Readonly<{
  dictionary?: Dictionary;
  entry?: DictionaryItem;
  parent?: Dictionary;
  onSaved: () => void;
}>) {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const itemMode = !!parent;
  const [draft, setDraft] = useState({
    name: dictionary?.name ?? '',
    code: dictionary?.code ?? '',
    remark: dictionary?.remark ?? '',
    label: entry?.label ?? '',
    value: entry?.value ?? '',
    order: String(entry?.order ?? 0),
    status: entry?.status ?? dictionary?.status ?? 'active',
    tone: entry?.tone ?? 'default',
  });
  const [failure, setFailure] = useState<string>();
  const field = (key: 'name' | 'code' | 'remark' | 'label' | 'value' | 'order') => (
    <TextField
      label={t(`administration.${key}`)}
      value={draft[key]}
      onChange={(event) => setDraft((prior) => ({ ...prior, [key]: event.target.value }))}
    />
  );
  return (
    <DialogSurface
      triggerLabel={t(dictionary || entry ? 'administration.edit' : 'administration.create')}
      title={t(itemMode ? 'administration.items' : 'administration.dictionaries')}
      description={t('administration.description')}
      cancelLabel={t('administration.cancel')}
      confirmLabel={t('administration.save')}
      {...(failure ? { failureMessage: failure } : {})}
      onConfirm={async () => {
        try {
          if (parent) {
            await port.saveDictionaryItem(
              parent.id,
              {
                label: draft.label,
                value: draft.value,
                order: Number(draft.order),
                status: draft.status,
                tone: draft.tone,
              },
              entry,
            );
          } else {
            await port.saveDictionary(
              { name: draft.name, code: draft.code, remark: draft.remark, status: draft.status },
              dictionary,
            );
          }
          onSaved();
          setFailure(undefined);
        } catch (error) {
          setFailure(t('administration.failureDescription'));
          throw error;
        }
      }}
    >
      {itemMode ? (
        <>
          {field('label')}
          {field('value')}
          {field('order')}
          <SelectField
            label={t('administration.tone')}
            value={draft.tone}
            onValueChange={(value) => {
              if (
                value === 'default' ||
                value === 'primary' ||
                value === 'success' ||
                value === 'warning' ||
                value === 'danger'
              )
                setDraft((prior) => ({ ...prior, tone: value }));
            }}
            options={['default', 'primary', 'success', 'warning', 'danger'].map((value) => ({
              value,
              label: value,
            }))}
          />
        </>
      ) : (
        <>
          {field('name')}
          {field('code')}
          {field('remark')}
        </>
      )}
      <SelectField
        label={t('administration.status')}
        value={draft.status}
        onValueChange={(value) => {
          if (value === 'active' || value === 'disabled')
            setDraft((prior) => ({ ...prior, status: value }));
        }}
        options={[
          { value: 'active', label: t('administration.active') },
          { value: 'disabled', label: t('administration.disabled') },
        ]}
      />
    </DialogSurface>
  );
}
function DeleteDictionary({
  dictionary,
  entry,
  onSaved,
}: Readonly<{ dictionary?: Dictionary; entry?: DictionaryItem; onSaved: () => void }>) {
  const { t } = useFrontendTranslation();
  const port = useRequiredAdministration();
  const [failure, setFailure] = useState<string>();
  return (
    <DialogSurface
      triggerLabel={t('administration.remove')}
      title={t('administration.remove')}
      description={entry?.label ?? dictionary?.name ?? ''}
      cancelLabel={t('administration.cancel')}
      confirmLabel={t('administration.confirm')}
      {...(failure ? { failureMessage: failure } : {})}
      onConfirm={async () => {
        try {
          if (entry) await port.removeDictionaryItem(entry);
          else if (dictionary) await port.removeDictionary(dictionary);
          onSaved();
        } catch (error) {
          setFailure(t('administration.failureDescription'));
          throw error;
        }
      }}
    >
      <p>{t('administration.description')}</p>
    </DialogSurface>
  );
}
export function BackendDictionariesPage() {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const state = useRemote(useCallback(() => port.dictionaries(), [port]));
  const [selected, setSelected] = useState('');
  const parent = state.value?.types.find((item) => item.id === selected);
  const typeColumns: readonly DataColumn<Dictionary>[] = [
    { id: 'name', label: t('administration.name'), rowHeader: true, render: (item) => item.name },
    { id: 'code', label: t('administration.code'), render: (item) => item.code },
    {
      id: 'status',
      label: t('administration.status'),
      render: (item) => t(`administration.${item.status === 'active' ? 'active' : 'disabled'}`),
    },
    {
      id: 'actions',
      label: t('administration.actions'),
      render: (item) => (
        <div className="flex flex-wrap gap-2">
          <DictionaryEditor
            key={`${item.id}-${item.version}`}
            dictionary={item}
            onSaved={state.reload}
          />
          <DeleteDictionary dictionary={item} onSaved={state.reload} />
        </div>
      ),
    },
  ];
  const itemColumns: readonly DataColumn<DictionaryItem>[] = [
    {
      id: 'label',
      label: t('administration.label'),
      rowHeader: true,
      render: (item) => item.label,
    },
    { id: 'value', label: t('administration.value'), render: (item) => item.value },
    { id: 'order', label: t('administration.order'), render: (item) => item.order },
    {
      id: 'actions',
      label: t('administration.actions'),
      render: (item) => (
        <div className="flex flex-wrap gap-2">
          {parent ? (
            <DictionaryEditor
              key={`${item.id}-${item.version}`}
              parent={parent}
              entry={item}
              onSaved={state.reload}
            />
          ) : null}
          <DeleteDictionary entry={item} onSaved={state.reload} />
        </div>
      ),
    },
  ];
  return (
    <Page>
      <PageHeader
        title={t('administration.dictionaries')}
        description={t('administration.description')}
      />
      <Toolbar
        label={t('administration.actions')}
        primary={
          <div className="flex flex-wrap gap-2">
            <DictionaryEditor onSaved={state.reload} />
            <Action onPress={state.reload}>{t('administration.refresh')}</Action>
          </div>
        }
      />
      <RemoteRegion {...state}>
        <DataTable
          label={t('administration.dictionaries')}
          columns={typeColumns}
          rows={state.value?.types ?? []}
          emptyContent={t('administration.empty')}
        />
        <Section title={t('administration.items')}>
          <SelectField
            label={t('administration.dictionaries')}
            value={selected}
            onValueChange={setSelected}
            options={[
              { value: '', label: t('administration.empty') },
              ...(state.value?.types ?? []).map((item) => ({ value: item.id, label: item.name })),
            ]}
          />
          {parent ? <DictionaryEditor parent={parent} onSaved={state.reload} /> : null}
          <DataTable
            label={t('administration.items')}
            columns={itemColumns}
            rows={(state.value?.items ?? []).filter((item) => item.typeId === selected)}
            emptyContent={t('administration.empty')}
          />
        </Section>
      </RemoteRegion>
    </Page>
  );
}
