'use client';

import { useCallback, useState, useSyncExternalStore, type ReactNode } from 'react';
import { FrontendMessages, formatNumber, useFrontendTranslation } from '@clouddrive/i18n';
import { formatInstant } from '@clouddrive/i18n/format';
import { usePreferencesPort } from '@clouddrive/plugin-framework/preferences';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { DataTable } from '@clouddrive/ui-adapter/data-display';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { DisclosurePanel } from '@clouddrive/ui-adapter/disclosure';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { useRequiredAdministration } from '../../../src/administration/context';
import {
  RuntimeReadError,
  type RuntimeDiagnostics,
} from '../../../src/administration/runtime-model';
import { formatFileBytes } from '../../../src/files/format';
import { useProductAccess } from '../../../src/identity/use-access';
import { NavigationIcon } from '../../../src/navigation-icon-presentation';
import type { Preferences } from '../../../src/preferences-model';
import { runtimeMessages } from './runtime-messages';
import { useCatalogRequest } from './use-catalog-request';

function useRuntimeText() {
  const { t, locale } = useFrontendTranslation();
  const preferences = usePreferencesPort<Preferences>();
  const region = useSyncExternalStore(
    preferences.subscribe,
    preferences.getSnapshot,
    preferences.getSnapshot,
  ).localeRegion;
  return {
    t,
    locale,
    label: (key: string) => t('systemRuntime.' + key),
    instant: (value: string) =>
      Number.isFinite(Date.parse(value))
        ? formatInstant(locale, region, value)
        : t('systemRuntime.notProvided'),
  };
}

function RuntimeRead<T>({
  load,
  children,
}: Readonly<{
  load: (signal: AbortSignal) => Promise<T>;
  children: (value: T) => ReactNode;
}>) {
  const { t, label } = useRuntimeText();
  const state = useCatalogRequest(load);
  if (!state.result) return <p role="status">{t('administration.loading')}</p>;
  if ('error' in state.result)
    return (
      <StateSurface
        compact
        state="warning"
        icon={<NavigationIcon iconId="settings" />}
        title={label('failure')}
        description={label(
          'errors.' +
            (state.result.error instanceof RuntimeReadError
              ? state.result.error.code
              : 'unavailable'),
        )}
        actionLabel={t('administration.retry')}
        onAction={state.refresh}
        announcement="polite"
      />
    );
  return children(state.result.value);
}

function Probe({ kind }: { kind: 'readiness' | 'liveness' }) {
  const port = useRequiredAdministration();
  const { label } = useRuntimeText();
  const load = useCallback((signal: AbortSignal) => port.runtime.probe(kind, signal), [port, kind]);
  return (
    <Section title={label(kind)} description={label(kind + 'Hint')} contentInset>
      <RuntimeRead load={load}>
        {(value) => (
          <StatusPill tone={value.status === 'pass' ? 'success' : 'danger'}>
            {label(
              kind === 'readiness'
                ? value.status === 'pass'
                  ? 'accepting'
                  : 'notReady'
                : value.status === 'pass'
                  ? 'alive'
                  : 'notAlive',
            )}
          </StatusPill>
        )}
      </RuntimeRead>
    </Section>
  );
}

function DiagnosticFacts({ value }: { value: RuntimeDiagnostics }) {
  const { t, locale, label, instant } = useRuntimeText();
  const readiness = (ready: boolean) => (
    <StatusPill tone={ready ? 'success' : 'warning'}>
      {label(ready ? 'ready' : 'unavailable')}
    </StatusPill>
  );
  const health = (state: string, enabled: boolean) => {
    const known: Record<string, string> = { pass: 'healthy', warn: 'degraded', fail: 'unhealthy' };
    return (
      <StatusPill
        tone={
          !enabled
            ? 'neutral'
            : state === 'pass'
              ? 'success'
              : state === 'fail'
                ? 'danger'
                : 'warning'
        }
      >
        {!enabled
          ? label('disabled')
          : known[state]
            ? label(known[state])
            : state || label('unknown')}
      </StatusPill>
    );
  };
  const process = value.process;
  const failedUnits =
    value.units?.filter((unit) => unit.State === 'failed' || unit.State === 'forced').length ?? 0;
  const failure = [
    { id: 'phase', term: label('phase'), description: value.lastFailurePhase },
    { id: 'owner', term: label('owner'), description: value.lastFailureOwner },
    { id: 'type', term: label('failureType'), description: value.lastFailureType },
  ].filter((item) => item.description);
  return (
    <div className="space-y-6">
      {value.cleanupRequired ? <StatusPill tone="warning">{label('cleanup')}</StatusPill> : null}
      {failedUnits > 0 ? (
        <StatusPill tone="danger">
          {t('systemRuntime.failedUnits', { count: failedUnits })}
        </StatusPill>
      ) : null}
      <DescriptionList
        label={label('dependencies')}
        columns={2}
        items={[
          { id: 'auth', term: label('authentication'), description: readiness(value.authReady) },
          { id: 'database', term: label('database'), description: readiness(value.databaseReady) },
          {
            id: 'scheduler',
            term: label('scheduler'),
            description: health(value.schedulerHealth, value.scheduler.enabled),
          },
          {
            id: 'messaging',
            term: label('messaging'),
            description: health(value.messagingHealth, value.messaging.enabled),
          },
          {
            id: 'telemetry',
            term: label('telemetry'),
            description: value.telemetry.enabled ? (
              readiness(value.telemetry.ready)
            ) : (
              <StatusPill>{label('disabled')}</StatusPill>
            ),
          },
        ]}
      />
      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">{label('lastFailure')}</h3>
        {failure.length ? (
          <DescriptionList label={label('lastFailure')} columns={2} items={failure} />
        ) : (
          <p className="text-sm text-ink-muted">{label('noFailure')}</p>
        )}
      </div>
      <DescriptionList
        label={label('process')}
        columns={2}
        items={[
          {
            id: 'uptime',
            term: label('uptime'),
            description: t('systemRuntime.seconds', {
              value: formatNumber(locale, Math.floor(process.uptimeSeconds)),
            }),
          },
          {
            id: 'requests',
            term: label('activeRequests'),
            description: formatNumber(locale, value.activeRequests),
          },
          {
            id: 'connections',
            term: label('activeConnections'),
            description: formatNumber(locale, value.activeConnections),
          },
          { id: 'memory', term: label('memory'), description: formatFileBytes(process.allocBytes) },
        ]}
      />
      <DisclosurePanel title={label('diagnosticDetails')}>
        <div className="mb-5">
          <DescriptionList
            label={label('process')}
            columns={2}
            items={[
              {
                id: 'systemMemory',
                term: label('systemMemory'),
                description: formatFileBytes(process.sysBytes),
              },
              {
                id: 'goroutines',
                term: label('goroutines'),
                description: formatNumber(locale, process.numGoroutine),
              },
              { id: 'gc', term: label('gc'), description: formatNumber(locale, process.numGC) },
              {
                id: 'generation',
                term: label('generation'),
                description: formatNumber(locale, value.generation),
              },
              { id: 'phase', term: label('phase'), description: value.phase },
              { id: 'processState', term: label('processState'), description: value.processState },
              {
                id: 'generationState',
                term: label('generationState'),
                description: value.generationState,
              },
              { id: 'since', term: label('since'), description: instant(value.since) },
            ]}
          />
        </div>
        {value.telemetry.lastErrorType ? (
          <p className="mb-4 break-words text-sm text-danger">
            {label('telemetry')} · {label('failureType')}: {value.telemetry.lastErrorType}
          </p>
        ) : null}
        <DataTable
          label={label('units')}
          columns={[
            { id: 'owner', label: label('owner'), rowHeader: true, render: (row) => row.Owner },
            { id: 'kind', label: label('unitKind'), render: (row) => label(row.Kind) },
            {
              id: 'state',
              label: label('unitState'),
              render: (row) => (
                <StatusPill
                  tone={row.State === 'failed' || row.State === 'forced' ? 'danger' : 'neutral'}
                >
                  {t('systemRuntime.states.' + row.State, { defaultValue: row.State })}
                </StatusPill>
              ),
            },
            { id: 'phase', label: label('phase'), render: (row) => row.Phase },
            {
              id: 'attempt',
              label: label('attempt'),
              render: (row) => formatNumber(locale, row.Attempt),
            },
            { id: 'error', label: label('failureType'), render: (row) => row.LastErrorType || '—' },
            { id: 'since', label: label('since'), render: (row) => instant(row.Since) },
          ]}
          rows={(value.units ?? []).map((unit, index) => ({
            ...unit,
            id: unit.Owner + ':' + index,
          }))}
          emptyContent={t('administration.empty')}
        />
      </DisclosurePanel>
    </div>
  );
}

function Metrics() {
  const port = useRequiredAdministration();
  const { t, locale, label, instant } = useRuntimeText();
  const [raw, setRaw] = useState(false);
  return (
    <Section title={label('metrics')} description={label('metricsHint')} contentInset>
      <div className="space-y-5">
        <RuntimeRead load={port.runtime.metrics}>
          {(value) => (
            <div className="space-y-4">
              <DescriptionList
                label={label('metrics')}
                columns={2}
                items={value.items.map((item) => ({
                  id: item.key,
                  term: t('systemRuntime.metricNames.' + item.key, { defaultValue: item.key }),
                  description:
                    item.unit === 'bytes'
                      ? formatFileBytes(item.value)
                      : item.unit === 'seconds'
                        ? t('systemRuntime.seconds', {
                            value: formatNumber(locale, item.value, { maximumFractionDigits: 2 }),
                          })
                        : formatNumber(locale, item.value) +
                          (item.unit && item.unit !== 'count' ? ' ' + item.unit : ''),
                }))}
              />
              <p className="text-xs text-ink-muted">
                {label('asOf')} · {instant(value.asOf)}
              </p>
            </div>
          )}
        </RuntimeRead>
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">{label('rawHint')}</p>
          <Action variant="quiet" onPress={() => setRaw((value) => !value)}>
            {label(raw ? 'hideRawMetrics' : 'rawMetrics')}
          </Action>
          {raw ? (
            <RuntimeRead load={port.runtime.metricsText}>
              {(text) => (
                <pre className="max-h-96 max-w-full overflow-auto whitespace-pre-wrap break-all font-mono text-xs">
                  {text}
                </pre>
              )}
            </RuntimeRead>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function Deployment() {
  const port = useRequiredAdministration();
  const { t, label, instant } = useRuntimeText();
  const provided = (value: string) => (value && value !== 'unknown' ? value : label('notProvided'));
  return (
    <Section title={label('build')} contentInset>
      <div className="space-y-5">
        <RuntimeRead load={port.runtime.build}>
          {(value) => (
            <DescriptionList
              label={label('build')}
              columns={2}
              items={[
                { id: 'version', term: label('version'), description: provided(value.version) },
                { id: 'commit', term: label('commit'), description: provided(value.commit) },
                { id: 'time', term: label('buildTime'), description: instant(value.buildTime) },
                { id: 'go', term: label('goVersion'), description: provided(value.goVersion) },
                {
                  id: 'source',
                  term: label('sourceState'),
                  description: label(value.dirty ? 'dirty' : 'clean'),
                },
              ]}
            />
          )}
        </RuntimeRead>
        <DisclosurePanel title={label('configuration')} description={label('configurationHint')}>
          <RuntimeRead load={port.runtime.metadata}>
            {(value) => (
              <div className="space-y-5">
                <DataTable
                  label={label('configuration')}
                  columns={[
                    {
                      id: 'name',
                      label: t('administration.name'),
                      rowHeader: true,
                      render: (row) => row.name,
                    },
                    { id: 'value', label: t('administration.value'), render: (row) => row.value },
                  ]}
                  rows={value.configuration.map((row) => ({ ...row, id: row.name }))}
                  emptyContent={t('administration.empty')}
                />
                <h3 className="text-sm font-semibold text-ink">{label('capabilities')}</h3>
                <ul className="flex flex-wrap gap-2">
                  {value.capabilities.map((name) => (
                    <li key={name}>
                      <StatusPill>{name}</StatusPill>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </RuntimeRead>
        </DisclosurePanel>
      </div>
    </Section>
  );
}

function SecurityEvents() {
  const port = useRequiredAdministration();
  const { t, label, instant } = useRuntimeText();
  const [cursors, setCursors] = useState(['']);
  const [page, setPage] = useState(0);
  const cursor = cursors[page] ?? '';
  const load = useCallback(
    (signal: AbortSignal) => port.securityAudit(cursor, signal),
    [port, cursor],
  );
  return (
    <RuntimeRead load={load}>
      {(value) => (
        <div className="space-y-4">
          <DataTable
            label={label('security')}
            columns={[
              {
                id: 'operation',
                label: label('operation'),
                rowHeader: true,
                render: (row) => row.operation,
              },
              {
                id: 'decision',
                label: t('administration.decision'),
                render: (row) =>
                  t('systemRuntime.decisions.' + row.decision, { defaultValue: row.decision }),
              },
              {
                id: 'outcome',
                label: t('administration.outcome'),
                render: (row) =>
                  t('systemRuntime.outcomes.' + row.outcome, { defaultValue: row.outcome }),
              },
              {
                id: 'time',
                label: t('administration.date'),
                render: (row) => instant(row.occurredAt),
              },
            ]}
            rows={value.items.map((row) => ({ ...row, id: row.eventId }))}
            emptyContent={t('administration.empty')}
          />
          <div className="flex gap-2">
            <Action
              variant="secondary"
              disabled={page === 0}
              onPress={() => setPage((value) => value - 1)}
            >
              {t('administration.previous')}
            </Action>
            <Action
              variant="secondary"
              disabled={!value.hasMore || !value.nextCursor}
              onPress={() => {
                if (value.nextCursor) {
                  setCursors((prior) => [...prior.slice(0, page + 1), value.nextCursor!]);
                  setPage((value) => value + 1);
                }
              }}
            >
              {t('administration.next')}
            </Action>
          </div>
        </div>
      )}
    </RuntimeRead>
  );
}

function RuntimeContent() {
  const port = useRequiredAdministration();
  const { t, label } = useRuntimeText();
  const access = useProductAccess();
  const [revision, setRevision] = useState(0);
  const [security, setSecurity] = useState(false);
  return (
    <Page>
      <PageHeader
        title={label('title')}
        description={label('description')}
        actions={
          <Action variant="quiet" onPress={() => setRevision((value) => value + 1)}>
            {t('files.refresh')}
          </Action>
        }
      />
      <p className="text-sm text-ink-muted">{label('snapshot')}</p>
      <div key={revision} className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <Probe kind="readiness" />
          <Probe kind="liveness" />
        </div>
        <Section title={label('diagnostics')} description={label('diagnosticsHint')} contentInset>
          <RuntimeRead load={port.runtime.diagnostics}>
            {(value) => <DiagnosticFacts value={value} />}
          </RuntimeRead>
        </Section>
        <Metrics />
        <Deployment />
        {access.data?.nativePermissions?.includes('auth:audit:read') ? (
          <Section title={label('security')} description={label('securityHint')} contentInset>
            <div className="space-y-4">
              <Action variant="quiet" onPress={() => setSecurity((value) => !value)}>
                {label(security ? 'hideSecurity' : 'showSecurity')}
              </Action>
              {security ? <SecurityEvents /> : null}
            </div>
          </Section>
        ) : null}
      </div>
    </Page>
  );
}

export function RuntimePage() {
  const { t } = useFrontendTranslation();
  return (
    <FrontendMessages
      resources={runtimeMessages}
      fallback={<p role="status">{t('administration.loading')}</p>}
    >
      <RuntimeContent />
    </FrontendMessages>
  );
}
