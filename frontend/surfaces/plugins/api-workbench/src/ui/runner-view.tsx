'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import type {
  ApiCollection,
  ApiRequestDefinition,
  RequestTransport,
} from '@clouddrive/surface/api-workbench';
import { Action } from '@clouddrive/ui-adapter/action';
import { DisclosurePanel } from '@clouddrive/ui-adapter/disclosure';
import { ProgressMeter } from '@clouddrive/ui-adapter/progress-meter';
import { SelectField } from '@clouddrive/ui-adapter/form-field';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { Play } from 'lucide-react';
import { runCollectionBatch } from '../model/runner';
import { useWorkbenchStore } from '../../stores/workbench';
import { useWorkbenchFormat } from './use-workbench-format';
export type RunnerViewProps = Readonly<{
  collections: readonly ApiCollection[];
  requests: readonly ApiRequestDefinition[];
  transport: RequestTransport;
  envVars: Record<string, string>;
  globalVars: Record<string, string>;
}>;
export function RunnerView({
  collections,
  requests,
  transport,
  envVars,
  globalVars,
}: RunnerViewProps) {
  const { t } = useFrontendTranslation();
  const format = useWorkbenchFormat();
  const selectedColId = useWorkbenchStore((s) => s.selectedCollectionIdForRunner);
  const setSelectedColId = useWorkbenchStore((s) => s.setSelectedCollectionIdForRunner);
  const state = useWorkbenchStore((s) => s.runnerState);
  const setState = useWorkbenchStore((s) => s.setRunnerState);
  const targetRequests = requests.filter((request) => request.collectionId === selectedColId);
  const run = async () => {
    if (useWorkbenchStore.getState().runnerState.isRunning || targetRequests.length === 0) return;
    setState({
      isRunning: true,
      currentProgress: 0,
      total: targetRequests.length,
      result: null,
      error: false,
    });
    try {
      const result = await runCollectionBatch(
        targetRequests,
        envVars,
        globalVars,
        transport,
        (_item, currentProgress, total) => setState({ currentProgress, total }),
      );
      setState({ result });
    } catch {
      setState({ error: true });
    } finally {
      setState({ isRunning: false });
    }
  };
  return (
    <div className="grid min-w-0 gap-4">
      <p className="text-sm leading-6 text-ink-muted">{t('apiWorkbench.runner.intro')}</p>
      <SelectField
        label={t('apiWorkbench.runner.selectCollection')}
        options={collections.map((collection) => ({
          value: collection.id,
          label: collection.name,
        }))}
        value={selectedColId}
        disabled={state.isRunning}
        onValueChange={setSelectedColId}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Action
          leadingIcon={<Play className="size-4" />}
          loading={state.isRunning}
          disabled={targetRequests.length === 0}
          onPress={() => void run()}
        >
          {t(state.isRunning ? 'apiWorkbench.runner.running' : 'apiWorkbench.runner.run')}
        </Action>
        <span className="text-sm text-ink-muted">
          {t('apiWorkbench.runner.count', { count: targetRequests.length })}
        </span>
      </div>
      <p className="text-xs leading-5 text-ink-muted">{t('apiWorkbench.workspace.savedVersion')}</p>
      {state.isRunning && (
        <ProgressMeter
          label={t('apiWorkbench.runner.progress', {
            done: format.count(state.currentProgress),
            total: format.count(state.total),
          })}
          value={state.total > 0 ? Math.round((state.currentProgress / state.total) * 100) : 0}
        />
      )}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {t('apiWorkbench.runner.error')}
        </p>
      )}
      {state.result && (
        <div className="grid min-w-0 gap-4">
          <div className="grid gap-2 border-y border-border py-3">
            <h3 className="text-sm font-semibold text-ink">{t('apiWorkbench.runner.summary')}</h3>
            <p className="text-sm text-ink">
              {t('apiWorkbench.tasks.result', {
                passed: format.count(state.result.passed),
                failed: format.count(state.result.failed),
                total: format.count(state.result.total),
              })}
            </p>
            <span className="text-xs text-ink-muted">
              {format.duration(state.result.durationMs)}
            </span>
          </div>
          {state.result.items.map((item) => (
            <div key={item.requestId} className="grid min-w-0 gap-2 border-b border-border pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={item.skipped ? 'neutral' : item.passed ? 'success' : 'danger'}>
                  {item.skipped
                    ? t('apiWorkbench.runner.skipped')
                    : t(
                        item.passed
                          ? 'apiWorkbench.runner.resultPass'
                          : 'apiWorkbench.runner.resultFail',
                      )}
                </StatusPill>
                <span className="font-mono text-xs text-ink-muted">{item.method}</span>
                <span className="min-w-0 break-words text-sm font-semibold text-ink">
                  {item.requestName}
                </span>
              </div>
              <code className="min-w-0 break-all text-xs text-ink-muted">{item.url}</code>
              <div className="flex flex-wrap gap-3 text-xs text-ink-muted">
                {item.status !== undefined && (
                  <span>
                    {t('apiWorkbench.runner.http')}: {format.count(item.status)}
                  </span>
                )}
                <span>{format.duration(item.durationMs)}</span>
                <span>
                  {t('apiWorkbench.runner.assertions', {
                    passed: format.count(item.tests.filter((test) => test.passed).length),
                    total: format.count(item.tests.length),
                  })}
                </span>
              </div>
              {item.status !== undefined && item.status >= 400 && (
                <p className="text-xs leading-5 text-warning">
                  {t('apiWorkbench.runner.httpFailure')}
                </p>
              )}
              {item.error && <p className="break-words text-sm text-danger">{item.error}</p>}
              {item.tests.length > 0 && (
                <DisclosurePanel title={t('apiWorkbench.response.assertions')}>
                  <ul className="grid gap-2">
                    {item.tests.map((test, index) => (
                      <li key={index} className="break-words">
                        {test.passed ? '✓' : '✗'} {test.title}
                        {test.error ? ` — ${test.error}` : ''}
                      </li>
                    ))}
                  </ul>
                </DisclosurePanel>
              )}
            </div>
          ))}
        </div>
      )}
      {!state.result && !state.isRunning && targetRequests.length === 0 && (
        <p className="py-4 text-sm text-ink-muted">{t('apiWorkbench.runner.empty')}</p>
      )}
    </div>
  );
}
