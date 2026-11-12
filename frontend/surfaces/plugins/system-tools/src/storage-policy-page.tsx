'use client';

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import {
  FoundationControlledField,
  FoundationForm,
  useFoundationForm,
} from '@clouddrive/form-foundation';
import { formatNumber, FrontendMessages, useFrontendTranslation } from '@clouddrive/i18n';
import { formatInstant } from '@clouddrive/i18n/format';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { useRegisterDirtySource } from '@clouddrive/plugin-framework/leave-confirm';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DataTable } from '@clouddrive/ui-adapter/data-display';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { formatFileBytes } from '../../../src/files/format';
import { FilesError } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import type { StoragePolicy } from '../../../src/files/storage-policy';
import type { Preferences } from '../../../src/preferences-model';
import { storageMessages } from './storage-messages';
import { CatalogFailure } from './catalog-failure';
import { useCatalogRequest } from './use-catalog-request';
import { StorageNameRulesPanel } from './storage-name-rules-panel';
import { StorageEditDialog } from './storage-edit-dialog';
import {
  byteAmount,
  byteUnitFor,
  byteUnits,
  changeByteUnit,
  limitFields,
  storageLimitOverrides,
  storageLimitsDraft,
  storageLimitsSchema,
} from './storage-limit-form';

function limitText(value: number, locale: string) {
  const unit = byteUnitFor(value);
  return formatNumber(locale, Number(byteAmount(value, unit))) + ' ' + unit;
}

function UsageSnapshot() {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const label = (key: string) => t('systemStorage.' + key);
  const preferences = usePreferencesPort<Preferences>();
  const region = useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
    preferences.getSnapshot,
  ).localeRegion;
  const usage = useCatalogRequest(useCallback((signal) => files.readStorageUsage(signal), [files]));
  if (!usage.result) return <p role="status">{t('administration.loading')}</p>;
  if ('error' in usage.result)
    return <CatalogFailure error={usage.result.error} retry={usage.refresh} />;
  const value = usage.result.value;
  return (
    <div className="space-y-4">
      <DescriptionList
        label={label('usageTitle')}
        columns={2}
        items={[
          {
            id: 'bytes',
            term: label('referencedBytes'),
            description: formatFileBytes(value.blobBytes),
          },
          {
            id: 'objects',
            term: label('referencedObjects'),
            description: formatNumber(locale, value.blobCount),
          },
          {
            id: 'current',
            term: label('currentReferences'),
            description: formatNumber(locale, value.currentReferences),
          },
          {
            id: 'history',
            term: label('historyReferences'),
            description: formatNumber(locale, value.historyReferences),
          },
          {
            id: 'pending',
            term: label('pendingObjects'),
            description: formatNumber(locale, value.pendingCount),
          },
          {
            id: 'pendingBytes',
            term: label('pendingBytes'),
            description: formatFileBytes(value.pendingBytes),
          },
          {
            id: 'time',
            term: label('checkedAt'),
            description: formatInstant(locale, region, value.checkedAt),
          },
        ]}
      />
      <Action variant="quiet" onPress={usage.refresh}>
        {label('refreshUsage')}
      </Action>
    </div>
  );
}

function LimitsEditor({
  initial,
  onSaved,
  onClose,
}: Readonly<{
  initial: StoragePolicy;
  onSaved: (view: StoragePolicy) => void;
  onClose: () => void;
}>) {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const label = (key: string) => t('systemStorage.' + key);
  const [view, setView] = useState(initial);
  const [failure, setFailure] = useState<'conflict' | 'saveFailure' | 'reloadFailed'>();
  const [reloading, setReloading] = useState(false);
  const [conflict, setConflict] = useState(false);
  const active = useRef(true);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  const formId = useId();
  const form = useFoundationForm({
    schema: storageLimitsSchema(view.defaults),
    defaultValues: storageLimitsDraft(initial),
  });
  const busy = form.isSubmitting || reloading;
  useRegisterDirtySource({
    pageId: 'system-tools.storage.limits',
    message: () => t('identityProduct.unsaved'),
    isDirty: () => form.isDirty,
    isSubmitting: () => busy,
  });
  async function reload() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setFailure(undefined);
    setReloading(true);
    try {
      const latest = await files.readStoragePolicy(controller.signal);
      if (controller.signal.aborted || !active.current) return;
      setView(latest);
      form.reset(storageLimitsDraft(latest));
      setFailure(undefined);
      setConflict(false);
    } catch {
      if (!controller.signal.aborted && active.current) setFailure('reloadFailed');
    } finally {
      if (!controller.signal.aborted && active.current) setReloading(false);
    }
  }
  return (
    <StorageEditDialog
      title={label('editLimits')}
      saveLabel={label('saveLimits')}
      formId={formId}
      dirty={form.isDirty}
      busy={busy}
      disabled={busy || !view.canSave || !form.isDirty || conflict}
      conflict={conflict}
      {...(failure ? { error: label(failure) } : {})}
      onClose={onClose}
      onReload={reload}
    >
      {!view.canSave ? <p className="mb-4 text-sm text-ink-muted">{label('readonly')}</p> : null}
      <FoundationForm
        id={formId}
        form={form}
        className="space-y-6"
        onSubmit={async (draft) => {
          if (busy || conflict || !view.canSave || !form.isDirty) return;
          setFailure(undefined);
          try {
            const saved = await files.saveStoragePolicy({
              revision: view.revision,
              overrides: storageLimitOverrides(draft),
            });
            if (active.current) {
              form.reset(storageLimitsDraft(saved));
              onSaved(saved);
            }
          } catch (error) {
            if (active.current) {
              if (error instanceof FilesError && error.code === 'conflict') setConflict(true);
              setFailure(
                error instanceof FilesError && error.code === 'conflict'
                  ? 'conflict'
                  : 'saveFailure',
              );
            }
          }
        }}
      >
        {limitFields.map((key) => (
          <FoundationControlledField key={key} form={form} name={key}>
            {(field) => {
              const name = label('limitNames.' + key);
              const disabled = busy || conflict || !view.canSave;
              return (
                <fieldset className="min-w-0 space-y-3" disabled={disabled}>
                  <legend className="mb-2 text-sm font-semibold">{name}</legend>
                  <CheckboxField
                    label={label('inherit') + ' · ' + limitText(view.defaults[key], locale)}
                    checked={field.value.inherit}
                    disabled={disabled}
                    onCheckedChange={(inherit) => field.onChange({ ...field.value, inherit })}
                  />
                  {!field.value.inherit ? (
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                      <TextField
                        label={name}
                        value={field.value.amount}
                        inputMode="decimal"
                        maxLength={64}
                        disabled={disabled || field.value.inherit}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        hint={t('systemStorage.range', {
                          max: limitText(view.defaults[key], locale),
                        })}
                        {...(form.hasError(`${key}.amount`)
                          ? {
                              error: t('systemStorage.range', {
                                max: limitText(view.defaults[key], locale),
                              }),
                            }
                          : {})}
                        onChange={(event) =>
                          field.onChange({ ...field.value, amount: event.target.value })
                        }
                      />
                      <SelectField
                        label={t('systemStorage.unit', { label: name })}
                        value={field.value.unit}
                        options={byteUnits.map((unit) => ({ value: unit, label: unit }))}
                        disabled={disabled || field.value.inherit}
                        onValueChange={(unit) => {
                          const next = byteUnits.find((item) => item === unit);
                          if (next) field.onChange(changeByteUnit(field.value, next));
                        }}
                      />
                    </div>
                  ) : null}
                  <p className="text-xs leading-5 text-ink-muted">
                    {label('active')}: {limitText(view.active[key], locale)}
                  </p>
                </fieldset>
              );
            }}
          </FoundationControlledField>
        ))}
      </FoundationForm>
    </StorageEditDialog>
  );
}

function LimitsOverview({
  initial,
  refresh,
}: Readonly<{ initial: StoragePolicy; refresh: () => void }>) {
  const { t, locale } = useFrontendTranslation();
  const label = (key: string) => t('systemStorage.' + key);
  const { notify } = useFeedback();
  const [view, setView] = useState(initial);
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Section
        title={label('limitsTitle')}
        description={label('limitsHint')}
        contentInset
        action={
          view.canSave ? (
            <Action variant="secondary" onPress={() => setEditing(true)}>
              {label('editLimits')}
            </Action>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <StatusPill tone={view.pendingRestart ? 'warning' : 'success'}>
            {label(view.pendingRestart ? 'pending' : 'applied')}
          </StatusPill>
          {!view.canSave ? <p className="text-sm text-ink-muted">{label('readonly')}</p> : null}
          <DataTable
            label={label('limitsTitle')}
            columns={[
              {
                id: 'name',
                label: label('limitsTitle'),
                rowHeader: true,
                render: (row) => label('limitNames.' + row.id),
              },
              {
                id: 'active',
                label: label('active'),
                render: (row) => limitText(view.active[row.id], locale),
              },
              {
                id: 'saved',
                label: label('saved'),
                render: (row) => (
                  <div>
                    {limitText(view.configured[row.id], locale)}
                    {view.overrides[row.id] === undefined ? (
                      <span className="block text-xs text-ink-muted">{label('inherit')}</span>
                    ) : null}
                  </div>
                ),
              },
              {
                id: 'deployment',
                label: label('deployment'),
                render: (row) => limitText(view.defaults[row.id], locale),
              },
            ]}
            rows={limitFields.map((id) => ({ id }))}
            emptyContent="—"
          />
        </div>
      </Section>
      {editing ? (
        <LimitsEditor
          initial={view}
          onClose={() => {
            setEditing(false);
            refresh();
          }}
          onSaved={(saved) => {
            setView(saved);
            setEditing(false);
            notify({ title: label('savedFeedback'), tone: 'success' });
          }}
        />
      ) : null}
    </>
  );
}

function StoragePolicyContent() {
  const files = useFiles();
  const { t } = useFrontendTranslation();
  const label = (key: string) => t('systemStorage.' + key);
  const policy = useCatalogRequest(
    useCallback((signal) => files.readStoragePolicy(signal), [files]),
  );
  const [revision, setRevision] = useState(0);
  const [usage, setUsage] = useState(false);
  const backend =
    policy.result && 'value' in policy.result ? policy.result.value.backend : undefined;
  return (
    <Page>
      <PageHeader
        title={t('systemTools.nav.storage')}
        description={label('description')}
        actions={
          <Action
            variant="quiet"
            onPress={() => {
              policy.refresh();
              setRevision((value) => value + 1);
            }}
          >
            {t('files.refresh')}
          </Action>
        }
      />
      <Section title={label('usageTitle')} description={label('usageHint')} contentInset>
        <div className="space-y-5">
          {backend ? (
            <DescriptionList
              label={label('backend')}
              items={[
                {
                  id: 'backend',
                  term: label('backend'),
                  description: label('backendNames.' + backend),
                },
              ]}
            />
          ) : null}
          {usage ? (
            <UsageSnapshot key={revision} />
          ) : (
            <Action variant="secondary" onPress={() => setUsage(true)}>
              {label('loadUsage')}
            </Action>
          )}
        </div>
      </Section>
      {policy.result && 'value' in policy.result ? (
        <LimitsOverview initial={policy.result.value} refresh={policy.refresh} />
      ) : (
        <Section title={label('limitsTitle')} contentInset>
          {!policy.result ? (
            <p role="status">{t('administration.loading')}</p>
          ) : (
            <CatalogFailure error={policy.result.error} retry={policy.refresh} />
          )}
        </Section>
      )}
      <StorageNameRulesPanel key={revision} />
    </Page>
  );
}

export function StoragePolicyPage() {
  const { t } = useFrontendTranslation();
  return (
    <FrontendMessages
      resources={storageMessages}
      fallback={<p role="status">{t('administration.loading')}</p>}
    >
      <StoragePolicyContent />
    </FrontendMessages>
  );
}
