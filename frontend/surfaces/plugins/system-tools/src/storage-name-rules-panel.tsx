'use client';

import { useCallback, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { Panel } from '@clouddrive/ui-adapter/panel';
import { FilesError } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import type { StorageNameRules, StorageNameRulesView } from '../../../src/files/storage-policy';
import { CatalogFailure } from './catalog-failure';
import { useCatalogRequest } from './use-catalog-request';

const zh = {
  title: '上传名称规则',
  extensionMode: '扩展名规则模式',
  extensions: '文件扩展名',
  extensionHint: '使用逗号分隔，忽略大小写。留空表示不限。',
  patternMode: '文件名规则模式',
  pattern: '文件名正则',
  patternHint: '使用 Go RE2 语法。留空表示不限。',
  allow: '允许匹配',
  deny: '拒绝匹配',
  active: '当前规则',
  unrestricted: '不限',
  pending: '保存的名称规则将在服务重启后生效。',
  applied: '已保存的名称规则已生效。',
  save: '保存名称规则',
  confirm: '确认名称规则',
  confirmHint: '服务重启后，新文件内容按保存的规则校验。',
  failure: '未能保存名称规则。请检查扩展名和 RE2 表达式。',
  conflict: '规则已被其他操作更新。请刷新后再保存。',
  testName: '试测文件名',
  testAction: '测试名称',
  testFailure: '无法测试，请检查名称、扩展名列表和 RE2 表达式。',
  result: { allowed: '通过规则', extension: '被扩展名规则拒绝', pattern: '被文件名正则拒绝' },
};
const en: typeof zh = {
  title: 'Upload name rules',
  extensionMode: 'Extension rule mode',
  extensions: 'File extensions',
  extensionHint: 'Comma separated and case insensitive. Leave blank to allow any extension.',
  patternMode: 'File name rule mode',
  pattern: 'File name expression',
  patternHint: 'Use Go RE2 syntax. Leave blank to allow any name.',
  allow: 'Allow matches',
  deny: 'Deny matches',
  active: 'Active rules',
  unrestricted: 'Unrestricted',
  pending: 'Saved name rules take effect after the service restarts.',
  applied: 'The saved name rules are active.',
  save: 'Save name rules',
  confirm: 'Confirm name rules',
  confirmHint: 'After restart, the service checks new file content against the saved rules.',
  failure: 'Could not save the rules. Check the extensions and RE2 expression.',
  conflict: 'The rules were updated elsewhere. Refresh before saving.',
  testName: 'Sample file name',
  testAction: 'Test name',
  testFailure: 'Check the sample name, extensions and RE2 expression.',
  result: {
    allowed: 'Allowed',
    extension: 'Blocked by extension rule',
    pattern: 'Blocked by file name expression',
  },
};

type Check = { name: string; rules: StorageNameRules };

function RuleSummary({ rules, labels }: { rules: StorageNameRules; labels: typeof zh }) {
  return (
    <dl className="space-y-2 text-sm">
      <div>
        <dt className="font-medium">{labels.extensions}</dt>
        <dd className="break-all">
          {rules.extensions.length
            ? labels[rules.extensionMode] + ' ' + rules.extensions.join(', ')
            : labels.unrestricted}
        </dd>
      </div>
      <div>
        <dt className="font-medium">{labels.pattern}</dt>
        <dd className="break-all">
          {rules.pattern ? labels[rules.patternMode] + ' ' + rules.pattern : labels.unrestricted}
        </dd>
      </div>
    </dl>
  );
}

function RuleCheck({ input, labels }: { input: Check; labels: typeof zh }) {
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
    const error = state.result.error;
    if (error instanceof FilesError && error.code === 'invalid')
      return <p role="alert">{labels.testFailure}</p>;
    return <CatalogFailure error={error} retry={state.refresh} />;
  }
  return <p role="status">{labels.result[state.result.value.decision]}</p>;
}

function RuleEditor({
  initial,
  labels,
  refresh,
}: {
  initial: StorageNameRulesView;
  labels: typeof zh;
  refresh: () => void;
}) {
  const files = useFiles();
  const { t } = useFrontendTranslation();
  const [view, setView] = useState(initial);
  const [rules, setRules] = useState(initial.rules);
  const [extensions, setExtensions] = useState(initial.rules.extensions.join(', '));
  const [name, setName] = useState('');
  const [check, setCheck] = useState<Check>();
  const [confirm, setConfirm] = useState(false);
  const [conflict, setConflict] = useState(false);
  const modes = [
    { value: 'allow', label: labels.allow },
    { value: 'deny', label: labels.deny },
  ];
  const values = {
    ...rules,
    extensions: extensions
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  };
  const dirty = JSON.stringify(values) !== JSON.stringify(view.rules);
  const enabled = view.canSave && !conflict;
  const save = async () => {
    try {
      const result = await files.saveStorageNameRules({ revision: view.revision, rules: values });
      setView(result);
      setRules(result.rules);
      setExtensions(result.rules.extensions.join(', '));
      setCheck(undefined);
    } catch (error) {
      setConflict(error instanceof FilesError && error.code === 'conflict');
      throw error;
    }
  };
  const update = (next: StorageNameRules) => {
    setRules(next);
    setCheck(undefined);
  };
  return (
    <>
      <p role="status" className="text-sm text-ink-muted">
        {view.pendingRestart ? labels.pending : labels.applied}
      </p>
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{labels.active}</h3>
        <RuleSummary rules={view.active} labels={labels} />
      </div>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (enabled && dirty) setConfirm(true);
        }}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <SelectField
              label={labels.extensionMode}
              options={modes}
              value={rules.extensionMode}
              disabled={!enabled}
              onValueChange={(value) =>
                update({ ...rules, extensionMode: value === 'deny' ? 'deny' : 'allow' })
              }
            />
            <TextField
              label={labels.extensions}
              hint={labels.extensionHint}
              value={extensions}
              maxLength={1100}
              disabled={!enabled}
              onChange={(event) => {
                setExtensions(event.target.value);
                setCheck(undefined);
              }}
            />
          </div>
          <div className="min-w-0 space-y-4">
            <SelectField
              label={labels.patternMode}
              options={modes}
              value={rules.patternMode}
              disabled={!enabled}
              onValueChange={(value) =>
                update({ ...rules, patternMode: value === 'deny' ? 'deny' : 'allow' })
              }
            />
            <TextField
              label={labels.pattern}
              hint={labels.patternHint}
              value={rules.pattern}
              maxLength={256}
              disabled={!enabled}
              onChange={(event) => update({ ...rules, pattern: event.target.value })}
            />
          </div>
        </div>
        {view.canSave ? (
          <Action type="submit" disabled={!enabled || !dirty}>
            {labels.save}
          </Action>
        ) : null}
      </form>
      {view.canSave ? (
        <div className="space-y-2">
          <TextField
            label={labels.testName}
            value={name}
            maxLength={255}
            onChange={(event) => {
              setName(event.target.value);
              setCheck(undefined);
            }}
          />
          <Action
            variant="secondary"
            disabled={!name}
            onPress={() => setCheck({ name, rules: values })}
          >
            {labels.testAction}
          </Action>
          {check ? <RuleCheck input={check} labels={labels} /> : null}
        </div>
      ) : null}
      {confirm ? (
        <DialogSurface
          isOpen
          triggerLabel={labels.confirm}
          title={labels.confirm}
          description={labels.confirmHint}
          confirmLabel={labels.save}
          confirmDisabled={conflict}
          failureMessage={conflict ? labels.conflict : labels.failure}
          cancelLabel={t('files.cancel')}
          onConfirm={save}
          onOpenChange={setConfirm}
        >
          {conflict ? (
            <Action variant="secondary" onPress={refresh}>
              {t('files.refresh')}
            </Action>
          ) : (
            <RuleSummary rules={values} labels={labels} />
          )}
        </DialogSurface>
      ) : null}
      {conflict && !confirm ? (
        <div className="space-y-2">
          <p role="alert">{labels.conflict}</p>
          <Action variant="secondary" onPress={refresh}>
            {t('files.refresh')}
          </Action>
        </div>
      ) : null}
    </>
  );
}

export function StorageNameRulesPanel() {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const state = useCatalogRequest(
    useCallback((signal) => files.readStorageNameRules(signal), [files]),
  );
  return (
    <Panel aria-label={labels.title} appearance="outlined" className="min-w-0 space-y-4 p-4">
      <h2 className="font-semibold">{labels.title}</h2>
      {!state.result ? <p role="status">{t('administration.loading')}</p> : null}
      {state.result && 'error' in state.result ? (
        <CatalogFailure error={state.result.error} retry={state.refresh} />
      ) : null}
      {state.result && 'value' in state.result ? (
        <RuleEditor initial={state.result.value} labels={labels} refresh={state.refresh} />
      ) : null}
    </Panel>
  );
}
