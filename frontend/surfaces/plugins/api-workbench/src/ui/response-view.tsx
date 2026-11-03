'use client';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import {
  useApiWorkbenchPort,
  type ExecutedResponse,
  type ExecutionFailure,
  type RequestHistoryItem,
  type ScriptExecutionResult,
} from '@clouddrive/surface/api-workbench';
import { Action } from '@clouddrive/ui-adapter/action';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { TabsView, type TabsViewItem } from '@clouddrive/ui-adapter/data-display';
import { AlertBanner } from '@clouddrive/ui-adapter/feedback';
import { useFeedback } from '@clouddrive/ui-adapter/feedback-context';
import { DisclosurePanel } from '@clouddrive/ui-adapter/disclosure';
import { DestructiveConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { Copy, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useWorkbenchStore } from '../../stores/workbench';
import { useWorkbenchFormat } from './use-workbench-format';
export type ResponseViewProps = Readonly<{
  response: ExecutedResponse | null;
  failure: ExecutionFailure | null;
  scriptResult: ScriptExecutionResult | null;
  isExecuting: boolean;
  history: readonly RequestHistoryItem[];
  onClearHistory: () => Promise<void>;
  onRestoreHistory: (item: RequestHistoryItem) => Promise<void>;
}>;
const tone = (status: number) =>
  status < 300 ? 'success' : status < 400 ? 'info' : status < 500 ? 'warning' : 'danger';
export function ResponseView({
  response,
  failure,
  scriptResult,
  isExecuting,
  history,
  onClearHistory,
  onRestoreHistory,
}: ResponseViewProps) {
  const { t } = useFrontendTranslation();
  const format = useWorkbenchFormat();
  const port = useApiWorkbenchPort();
  const feedback = useFeedback();
  const subtab = useWorkbenchStore((s) => s.activeResponseSubtab);
  const setSubtab = useWorkbenchStore((s) => s.setActiveResponseSubtab);
  const [clearOpen, setClearOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  let prettyBody = response?.body ?? '';
  if (response?.body) {
    try {
      prettyBody = JSON.stringify(JSON.parse(response.body), null, 2);
    } catch {
      /* Non-JSON bodies retain their source text. */
    }
  }
  const renderBody = (pretty: boolean) => {
    if (!response)
      return failure ? null : (
        <StateSurface
          compact
          state={scriptResult?.skipped ? 'warning' : 'empty'}
          icon={<Send className="size-5" />}
          title={t(
            scriptResult?.skipped ? 'apiWorkbench.response.skipped' : 'apiWorkbench.response.idle',
          )}
          description={t(
            scriptResult?.skipped
              ? 'apiWorkbench.response.skippedHint'
              : 'apiWorkbench.response.noResponse',
          )}
        />
      );
    if (!response.body)
      return (
        <StateSurface
          compact
          state="empty"
          icon={<Send className="size-5" />}
          title={t('apiWorkbench.response.emptyBody')}
          description={t('apiWorkbench.response.emptyBodyHint')}
        />
      );
    return (
      <div className="grid min-w-0 gap-3">
        <div className="flex justify-end">
          <Action
            variant="quiet"
            size="sm"
            leadingIcon={<Copy className="size-4" />}
            onPress={() => {
              void port.transfer
                .copyResponse(response.body)
                .then(() =>
                  feedback.notify({ title: t('apiWorkbench.feedback.copied'), tone: 'success' }),
                )
                .catch(() =>
                  feedback.notify({ title: t('apiWorkbench.feedback.copyFailed'), tone: 'danger' }),
                );
            }}
          >
            {t('apiWorkbench.response.copy')}
          </Action>
        </div>
        <pre className="max-h-128 min-w-0 overflow-auto rounded-control border border-border bg-surface-inset p-4 font-mono text-sm leading-6 text-ink">
          <code>{pretty ? prettyBody : response.body}</code>
        </pre>
      </div>
    );
  };
  const items: readonly TabsViewItem[] = [
    { id: 'pretty', label: t('apiWorkbench.response.pretty'), content: renderBody(true) },
    { id: 'raw', label: t('apiWorkbench.response.raw'), content: renderBody(false) },
    {
      id: 'headers',
      label: t('apiWorkbench.response.headers'),
      content: (
        <div className="min-w-0">
          {response?.headers.length ? (
            <dl className="grid min-w-0 divide-y divide-border">
              {response.headers.map(([key, value], index) => (
                <div key={index} className="grid min-w-0 gap-1 py-3 @lg/editor:grid-cols-2">
                  <dt className="break-all font-mono text-xs text-ink-muted">{key}</dt>
                  <dd className="break-all font-mono text-sm text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="py-6 text-sm text-ink-muted">{t('apiWorkbench.response.noHeaders')}</p>
          )}
        </div>
      ),
    },
    {
      id: 'history',
      label: t('apiWorkbench.response.history'),
      content: (
        <div className="grid min-w-0 gap-3">
          <p className="text-xs leading-5 text-ink-muted">
            {t('apiWorkbench.response.historyHint')}
          </p>
          {history.length > 0 && (
            <div>
              <Action
                variant="quiet"
                size="sm"
                leadingIcon={<Trash2 className="size-4" />}
                onPress={() => setClearOpen(true)}
              >
                {t('apiWorkbench.response.clearHistory')}
              </Action>
            </div>
          )}
          {history.length === 0 && (
            <p className="py-6 text-sm text-ink-muted">{t('apiWorkbench.response.noHistory')}</p>
          )}
          <div className="max-h-128 min-w-0 divide-y divide-border overflow-y-auto">
            {history.map((item) => (
              <button
                type="button"
                key={item.id}
                disabled={restoring}
                onClick={() => {
                  setRestoring(true);
                  void onRestoreHistory(item)
                    .catch(() => {
                      feedback.notify({
                        title: t('apiWorkbench.feedback.saveFailed'),
                        tone: 'danger',
                      });
                    })
                    .finally(() => setRestoring(false));
                }}
                className="grid w-full min-w-0 gap-2 rounded-control p-3 text-left outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={tone(item.status)}>{format.count(item.status)}</StatusPill>
                  <span className="font-mono text-xs text-ink">{item.method}</span>
                  <span className="text-xs text-ink-muted">
                    {format.duration(item.durationMs)} · {format.bytes(item.sizeBytes)}
                  </span>
                </span>
                <span className="min-w-0 break-all font-mono text-xs text-ink">{item.url}</span>
                <span className="text-xs text-ink-muted">{format.timestamp(item.timestamp)}</span>
                {!item.request && (
                  <span className="text-xs text-brand">
                    {t('apiWorkbench.response.restoreLegacy')}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ),
    },
  ];
  if (isExecuting)
    return (
      <StateSurface
        compact
        state="pending"
        announcement="polite"
        icon={<RefreshCw className="size-5" />}
        title={t('apiWorkbench.response.pending')}
        description={t('apiWorkbench.response.pendingHint')}
      />
    );
  return (
    <div className="@container/editor grid min-w-0 gap-4">
      {response && (
        <div
          className="flex flex-wrap items-center gap-3 border-b border-border pb-3"
          role="status"
        >
          <StatusPill tone={tone(response.status)}>
            {format.count(response.status)} {response.statusText}
          </StatusPill>
          <span className="text-xs text-ink-muted">
            {t('apiWorkbench.response.duration')}: {format.duration(response.durationMs)}
          </span>
          <span className="text-xs text-ink-muted">
            {t('apiWorkbench.response.size')}: {format.bytes(response.sizeBytes)}
          </span>
        </div>
      )}
      {failure && (
        <AlertBanner
          tone="danger"
          announcement="urgent"
          icon={<RefreshCw className="size-5" />}
          title={t('apiWorkbench.response.failed')}
          description={
            failure.details ??
            failure.message ??
            t(
              failure.kind === 'cors'
                ? 'apiWorkbench.response.corsNotice'
                : 'apiWorkbench.response.networkHint',
            )
          }
        />
      )}
      {Boolean(scriptResult?.tests.length) && (
        <div className="grid min-w-0 gap-3">
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="success">
              {format.count(scriptResult?.tests.filter((test) => test.passed).length ?? 0)}{' '}
              {t('apiWorkbench.response.testsPassed')}
            </StatusPill>
            {Boolean(scriptResult?.tests.some((test) => !test.passed)) && (
              <StatusPill tone="danger">
                {format.count(scriptResult?.tests.filter((test) => !test.passed).length ?? 0)}{' '}
                {t('apiWorkbench.response.testsFailed')}
              </StatusPill>
            )}
          </div>
          <DisclosurePanel title={t('apiWorkbench.response.assertions')}>
            <ul className="grid gap-2">
              {scriptResult?.tests.map((test, index) => (
                <li
                  key={index}
                  className={test.passed ? 'break-words text-ink' : 'break-words text-danger'}
                >
                  {test.passed ? '✓' : '✗'} {test.title}
                  {test.error ? ` — ${test.error}` : ''}
                </li>
              ))}
            </ul>
          </DisclosurePanel>
        </div>
      )}
      {Boolean(scriptResult?.logs.length) && (
        <DisclosurePanel title={t('apiWorkbench.response.logs')}>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">
            {scriptResult?.logs.join('\n')}
          </pre>
        </DisclosurePanel>
      )}
      <TabsView
        label={t('apiWorkbench.views.response')}
        items={items}
        selectedId={subtab}
        onSelectionChange={(id) => {
          if (id === 'pretty' || id === 'raw' || id === 'headers' || id === 'history')
            setSubtab(id);
        }}
      />
      <DestructiveConfirmDialog
        triggerLabel={t('apiWorkbench.response.clearHistory')}
        title={t('apiWorkbench.response.clearTitle')}
        description={t('apiWorkbench.response.clearDescription')}
        impact={t('apiWorkbench.common.deleteOneImpact')}
        cancelLabel={t('apiWorkbench.common.cancel')}
        confirmLabel={t('apiWorkbench.response.clearHistory')}
        failureMessage={t('apiWorkbench.feedback.saveFailed')}
        isOpen={clearOpen}
        onOpenChange={setClearOpen}
        onConfirm={async () => {
          await onClearHistory();
          setClearOpen(false);
        }}
      />
    </div>
  );
}
