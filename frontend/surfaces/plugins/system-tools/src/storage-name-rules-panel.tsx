'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { z } from 'zod';
import {
  FoundationControlledField,
  FoundationForm,
  useFoundationForm,
} from '@clouddrive/form-foundation';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useRegisterDirtySource } from '@clouddrive/plugin-framework/leave-confirm';
import { Section } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { FilesError } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import type { StorageNameRules, StorageNameRulesView } from '../../../src/files/storage-policy';
import { CatalogFailure } from './catalog-failure';
import { useCatalogRequest } from './use-catalog-request';
import { StorageEditDialog } from './storage-edit-dialog';

const extensionsOf = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
const draftOf = (rules: StorageNameRules) => ({
  ...rules,
  extensions: rules.extensions.join(', '),
});
const draftSchema = z.object({
  rules: z.object({
    extensionMode: z.enum(['allow', 'deny']),
    extensions: z.string().refine((value) => extensionsOf(value).length <= 32),
    patternMode: z.enum(['allow', 'deny']),
    pattern: z.string().max(256),
  }),
});
function rulesOf(draft: z.infer<typeof draftSchema>['rules']): StorageNameRules {
  return { ...draft, extensions: extensionsOf(draft.extensions) };
}
type Check = { name: string; rules: StorageNameRules };

function RuleSummary({ rules }: Readonly<{ rules: StorageNameRules }>) {
  const { t } = useFrontendTranslation();
  const label = (key: string) => t('systemTools.storage.' + key);
  return (
    <DescriptionList
      label={label('rulesTitle')}
      items={[
        {
          id: 'extensions',
          term: label('extensions'),
          description: rules.extensions.length
            ? label(rules.extensionMode) + ' · ' + rules.extensions.join(', ')
            : label('unrestricted'),
        },
        {
          id: 'pattern',
          term: label('pattern'),
          description: rules.pattern
            ? label(rules.patternMode) + ' · ' + rules.pattern
            : label('unrestricted'),
        },
      ]}
    />
  );
}
function RuleCheck({ input }: Readonly<{ input: Check }>) {
  const files = useFiles();
  const { t } = useFrontendTranslation();
  const state = useCatalogRequest(
    useCallback(
      (signal) => files.checkStorageNameRules(input.name, input.rules, signal),
      [files, input],
    ),
  );
  if (!state.result) return <p role="status">{t('administration.loading')}</p>;
  if ('error' in state.result) {
    if (state.result.error instanceof FilesError && state.result.error.code === 'invalid')
      return (
        <p role="alert" className="text-sm text-danger">
          {t('systemTools.storage.invalidRules')}
        </p>
      );
    return <CatalogFailure error={state.result.error} retry={state.refresh} />;
  }
  return (
    <p role="status" className="text-sm font-medium">
      {t('systemTools.storage.result.' + state.result.value.decision)}
    </p>
  );
}

function RulesEditor({
  initial,
  onSaved,
  onClose,
}: Readonly<{
  initial: StorageNameRulesView;
  onSaved: (view: StorageNameRulesView) => void;
  onClose: () => void;
}>) {
  const files = useFiles();
  const { t } = useFrontendTranslation();
  const label = (key: string) => t('systemTools.storage.' + key);
  const [view, setView] = useState(initial);
  const form = useFoundationForm({
    schema: draftSchema,
    defaultValues: { rules: draftOf(initial.rules) },
  });
  const formId = useId();
  const [failure, setFailure] = useState<
    'conflict' | 'saveFailure' | 'reloadFailed' | 'invalidRules'
  >();
  const [reloading, setReloading] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [sample, setSample] = useState('');
  const [check, setCheck] = useState<Check>();
  const active = useRef(true);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  const busy = form.isSubmitting || reloading;
  const disabled = busy || conflict || !view.canSave;
  useRegisterDirtySource({
    pageId: 'system-tools.storage.names',
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
      const latest = await files.readStorageNameRules(controller.signal);
      if (controller.signal.aborted || !active.current) return;
      setView(latest);
      form.reset({ rules: draftOf(latest.rules) });
      setFailure(undefined);
      setConflict(false);
      setCheck(undefined);
    } catch {
      if (!controller.signal.aborted && active.current) setFailure('reloadFailed');
    } finally {
      if (!controller.signal.aborted && active.current) setReloading(false);
    }
  }
  return (
    <StorageEditDialog
      title={label('editRules')}
      saveLabel={label('saveRules')}
      formId={formId}
      dirty={form.isDirty}
      busy={busy}
      disabled={disabled || !form.isDirty}
      conflict={conflict}
      {...(failure ? { error: label(failure) } : {})}
      onClose={onClose}
      onReload={reload}
    >
      {!view.canSave ? <p className="mb-4 text-sm text-ink-muted">{label('readonly')}</p> : null}
      <FoundationForm
        id={formId}
        form={form}
        onSubmit={async (draft) => {
          if (disabled || !form.isDirty) return;
          setFailure(undefined);
          setCheck(undefined);
          try {
            const saved = await files.saveStorageNameRules({
              revision: view.revision,
              rules: rulesOf(draft.rules),
            });
            if (active.current) {
              form.reset({ rules: draftOf(saved.rules) });
              onSaved(saved);
            }
          } catch (error) {
            if (active.current) {
              if (error instanceof FilesError && error.code === 'conflict') setConflict(true);
              setFailure(
                error instanceof FilesError
                  ? error.code === 'conflict'
                    ? 'conflict'
                    : error.code === 'invalid'
                      ? 'invalidRules'
                      : 'saveFailure'
                  : 'saveFailure',
              );
            }
          }
        }}
      >
        <FoundationControlledField form={form} name="rules">
          {(field) => {
            const value = field.value;
            function update(next: typeof value) {
              field.onChange(next);
              setCheck(undefined);
            }
            const modes = [
              { value: 'allow', label: label('allow') },
              { value: 'deny', label: label('deny') },
            ];
            return (
              <div className="space-y-6">
                <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                  <div className="min-w-0 space-y-3">
                    <SelectField
                      label={label('extensionMode')}
                      options={modes}
                      value={value.extensionMode}
                      disabled={disabled}
                      onValueChange={(mode) =>
                        update({ ...value, extensionMode: mode === 'deny' ? 'deny' : 'allow' })
                      }
                    />
                    <TextField
                      label={label('extensions')}
                      value={value.extensions}
                      disabled={disabled}
                      maxLength={1100}
                      hint={label('extensionsHint')}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      {...(form.hasError('rules.extensions')
                        ? { error: label('invalidRules') }
                        : {})}
                      onChange={(event) => update({ ...value, extensions: event.target.value })}
                    />
                  </div>
                  <div className="min-w-0 space-y-3">
                    <SelectField
                      label={label('patternMode')}
                      options={modes}
                      value={value.patternMode}
                      disabled={disabled}
                      onValueChange={(mode) =>
                        update({ ...value, patternMode: mode === 'deny' ? 'deny' : 'allow' })
                      }
                    />
                    <TextField
                      label={label('pattern')}
                      value={value.pattern}
                      disabled={disabled}
                      maxLength={256}
                      hint={label('patternHint')}
                      onChange={(event) => update({ ...value, pattern: event.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-3 border-t border-border pt-4">
                  <TextField
                    label={label('sampleName')}
                    value={sample}
                    maxLength={255}
                    disabled={busy}
                    hint={label('testHint')}
                    onChange={(event) => {
                      setSample(event.target.value);
                      setCheck(undefined);
                    }}
                  />
                  <Action
                    variant="secondary"
                    disabled={busy || !sample}
                    onPress={() => setCheck({ name: sample, rules: rulesOf(value) })}
                  >
                    {label('testName')}
                  </Action>
                  {check ? <RuleCheck input={check} /> : null}
                </div>
              </div>
            );
          }}
        </FoundationControlledField>
      </FoundationForm>
    </StorageEditDialog>
  );
}

function RulesOverview({
  initial,
  refresh,
}: Readonly<{ initial: StorageNameRulesView; refresh: () => void }>) {
  const { t } = useFrontendTranslation();
  const label = (key: string) => t('systemTools.storage.' + key);
  const { notify } = useFeedback();
  const [view, setView] = useState(initial);
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Section
        title={label('rulesTitle')}
        description={label('rulesHint')}
        contentInset
        action={
          view.canSave ? (
            <Action variant="secondary" onPress={() => setEditing(true)}>
              {label('editRules')}
            </Action>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <StatusPill tone={view.pendingRestart ? 'warning' : 'success'}>
            {label(view.pendingRestart ? 'pending' : 'applied')}
          </StatusPill>
          {!view.canSave ? <p className="text-sm text-ink-muted">{label('readonly')}</p> : null}
          <div className="grid min-w-0 gap-5 sm:grid-cols-2">
            <div className="min-w-0 space-y-3">
              <h3 className="text-sm font-semibold">{label('active')}</h3>
              <RuleSummary rules={view.active} />
            </div>
            {view.pendingRestart ? (
              <div className="min-w-0 space-y-3">
                <h3 className="text-sm font-semibold">{label('saved')}</h3>
                <RuleSummary rules={view.rules} />
              </div>
            ) : null}
          </div>
        </div>
      </Section>
      {editing ? (
        <RulesEditor
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
export function StorageNameRulesPanel() {
  const files = useFiles();
  const { t } = useFrontendTranslation();
  const state = useCatalogRequest(
    useCallback((signal) => files.readStorageNameRules(signal), [files]),
  );
  if (state.result && 'value' in state.result)
    return <RulesOverview initial={state.result.value} refresh={state.refresh} />;
  return (
    <Section title={t('systemTools.storage.rulesTitle')} contentInset>
      {!state.result ? (
        <p role="status">{t('administration.loading')}</p>
      ) : (
        <CatalogFailure error={state.result.error} retry={state.refresh} />
      )}
    </Section>
  );
}
