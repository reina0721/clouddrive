'use client';
import { useCallback, useState } from 'react';
import { Action } from '@clouddrive/ui-adapter/action';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { DataTable } from '@clouddrive/ui-adapter/data-display';
import { useRequiredAdministration } from '../../../src/administration/context';
import { useRemote, RemoteRegion } from '../../../src/administration/resource-state';
function SecurityEvents() {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const [cursors, setCursors] = useState(['']);
  const [page, setPage] = useState(0);
  const cursor = cursors[page] ?? '';
  const state = useRemote(useCallback(() => port.securityAudit(cursor), [port, cursor]));
  return (
    <Section title={t('administration.securityEvents')}>
      <RemoteRegion {...state}>
        <DataTable
          label={t('administration.securityEvents')}
          columns={[
            {
              id: 'operation',
              label: t('administration.operations'),
              rowHeader: true,
              render: (row) => row.operation,
            },
            { id: 'decision', label: t('administration.decision'), render: (row) => row.decision },
            { id: 'outcome', label: t('administration.outcome'), render: (row) => row.outcome },
            { id: 'time', label: t('administration.date'), render: (row) => row.occurredAt },
          ]}
          rows={(state.value?.items ?? []).map((row) => ({ ...row, id: row.eventId }))}
          emptyContent={t('administration.empty')}
        />
        <div className="flex gap-2">
          <Action disabled={page === 0} onPress={() => setPage((value) => value - 1)}>
            {t('administration.previous')}
          </Action>
          <Action
            disabled={!state.value?.hasMore || !state.value.nextCursor}
            onPress={() => {
              const next = state.value?.nextCursor;
              if (next) {
                setCursors((prior) => [...prior.slice(0, page + 1), next]);
                setPage((value) => value + 1);
              }
            }}
          >
            {t('administration.next')}
          </Action>
        </div>
      </RemoteRegion>
    </Section>
  );
}
export function RuntimePage() {
  const port = useRequiredAdministration();
  const { t } = useFrontendTranslation();
  const state = useRemote(useCallback(() => port.runtime(), [port]));
  return (
    <Page>
      <PageHeader
        title={t('administration.runtime')}
        description={t('administration.description')}
      />
      <RemoteRegion {...state}>
        {state.value ? (
          <>
            <Section title={t('administration.configuration')}>
              <DataTable
                label={t('administration.configuration')}
                columns={[
                  {
                    id: 'name',
                    label: t('administration.name'),
                    rowHeader: true,
                    render: (row) => row.name,
                  },
                  { id: 'value', label: t('administration.value'), render: (row) => row.value },
                ]}
                rows={state.value.configuration.map((row) => ({ ...row, id: row.name }))}
                emptyContent={t('administration.empty')}
              />
            </Section>
            <Section title={t('administration.capabilities')}>
              <ul>
                {state.value.capabilities.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </Section>
            <Section title={t('administration.readiness')}>
              <p>{state.value.readiness}</p>
            </Section>
            <Section title={t('administration.liveness')}>
              <p>{state.value.liveness}</p>
            </Section>
            <Section title={t('administration.build')}>
              <p>{state.value.build}</p>
            </Section>
            <Section title={t('administration.diagnostics')}>
              <DataTable
                label={t('administration.diagnostics')}
                columns={[
                  {
                    id: 'name',
                    label: t('administration.name'),
                    rowHeader: true,
                    render: (row) => row.name,
                  },
                  { id: 'state', label: t('administration.status'), render: (row) => row.state },
                ]}
                rows={state.value.diagnostics.map((item) => ({ ...item, id: item.name }))}
                emptyContent={t('administration.empty')}
              />
            </Section>
            <Section title={t('administration.metrics')}>
              <pre className="max-w-full overflow-auto whitespace-pre-wrap break-all font-mono text-sm">
                {state.value.metrics}
              </pre>
            </Section>
          </>
        ) : null}
      </RemoteRegion>
      <SecurityEvents />
    </Page>
  );
}
