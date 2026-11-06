'use client';
import { Cloud } from '../../../src/files/icons';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useFileTime } from './use-file-time';
import { Page, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { useEffect, useState } from 'react';
import type {
  ConnectionIssued,
  ConnectionListing,
  FileConnection,
} from '../../../src/files/connections';
import { FilesError } from '../../../src/files/model';
import { useConnections } from '../../../src/files/runtime';
import {
  ChangeConnectionDialog,
  CreateConnectionDialog,
  IssuedConnectionDialog,
  type ConnectionAction,
} from './connection-dialogs';

export function ConnectionsPage() {
  const time = useFileTime();
  const port = useConnections(),
    { t } = useFrontendTranslation();
  const [page, setPage] = useState<ConnectionListing>(),
    [cursor, setCursor] = useState(''),
    [previous, setPrevious] = useState<string[]>([]);
  const [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [failure, setFailure] = useState(''),
    [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false),
    [issued, setIssued] = useState<ConnectionIssued>();
  const [target, setTarget] = useState<{ connection: FileConnection; action: ConnectionAction }>();
  const [guide, setGuide] = useState('generic');
  useEffect(() => {
    const controller = new AbortController();
    void port
      .list(cursor, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setPage(value);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [port, cursor, revision, t]);
  function refresh() {
    setLoading(true);
    setFailure('');
    setRevision((value) => value + 1);
  }
  function issuedValue(value: ConnectionIssued) {
    setCreating(false);
    setTarget(undefined);
    setIssued(value);
    refresh();
  }
  const available = !loading && !failure;
  return (
    <>
      <Page>
        <Toolbar
          label={t('files.connections.title')}
          primary={<h1 className="text-2xl font-semibold">{t('files.connections.title')}</h1>}
          secondary={
            <div className="flex flex-wrap gap-2">
              <Action variant="secondary" disabled={loading} onPress={refresh}>
                {t('files.refresh')}
              </Action>
              <Action
                disabled={!available || !page || page.metadataLimited}
                onPress={() => setCreating(true)}
              >
                {t('files.connections.create')}
              </Action>
            </div>
          }
        />
        <section className="rounded-panel border border-border bg-surface p-4 sm:p-6">
          <p className="mt-2 text-sm text-ink-muted">{t('files.connections.subtitle')}</p>
          {notice ? (
            <p role="status" className="mt-4">
              {notice}
            </p>
          ) : null}
          {failure ? (
            <p role="alert" className="mt-4 text-danger">
              {failure}
            </p>
          ) : null}
          {loading ? (
            <p role="status" className="my-8">
              {t('files.loading')}
            </p>
          ) : available && page ? (
            <>
              {page.metadataLimited ? (
                <p role="alert" className="my-4 text-danger">
                  {t('files.connections.metadataLimited')}
                </p>
              ) : null}
              {page.items.length === 0 ? (
                <StateSurface
                  state="empty"
                  icon={<Cloud />}
                  title={t('files.connections.empty')}
                  description={t('files.connections.emptyHint')}
                />
              ) : (
                <ul className="mt-6 divide-y divide-border">
                  {page.items.map((connection) => (
                    <li
                      key={connection.id}
                      className="flex min-w-0 flex-wrap items-start justify-between gap-4 py-5"
                    >
                      <div className="min-w-0 flex-1 basis-64">
                        <h2 className="break-words font-semibold">{connection.name}</h2>
                        <p className="mt-2 break-words text-sm">
                          {t('files.connections.root')}:{' '}
                          {connection.rootPath || t('files.connections.rootUnavailable')}
                        </p>
                        <p className="mt-1 text-sm text-ink-muted">
                          {t(`files.connections.status.${connection.status}`)} ·{' '}
                          {t(
                            connection.readOnly
                              ? 'files.connections.readOnly'
                              : 'files.connections.readWrite',
                          )}{' '}
                          ·{' '}
                          {t(
                            connection.blockSystemFiles
                              ? 'files.connections.blockSystem'
                              : 'files.connections.allowSystem',
                          )}
                        </p>
                        <p className="mt-1 text-sm text-ink-muted">
                          {t('files.connections.expires')}: {time.full(connection.expiresAt)}
                        </p>
                        <p className="mt-1 text-sm text-ink-muted">
                          {t('files.connections.created')}: {time.full(connection.createdAt)}
                        </p>
                      </div>
                      <div className="flex max-w-full flex-wrap gap-2">
                        <Action
                          variant="secondary"
                          onPress={() => {
                            void port
                              .copyEndpoint(connection)
                              .then(() => setNotice(t('files.connections.copied')))
                              .catch((error: unknown) =>
                                setNotice(
                                  t(
                                    `files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`,
                                  ),
                                ),
                              );
                          }}
                        >
                          {t('files.connections.copyEndpoint')}
                        </Action>
                        {(
                          [
                            'rename',
                            'policy',
                            'rotate',
                            connection.status === 'disabled' ? 'enable' : 'disable',
                            'revoke',
                          ] as ConnectionAction[]
                        ).map((action) => (
                          <Action
                            key={action}
                            variant={action === 'revoke' ? 'danger' : 'secondary'}
                            disabled={
                              connection.status === 'revoked' ||
                              (action === 'rotate' && connection.status === 'expired')
                            }
                            onPress={() => setTarget({ connection, action })}
                          >
                            {t(`files.connections.actions.${action}`)}
                          </Action>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <Action
                  variant="secondary"
                  disabled={!previous.length}
                  onPress={() => {
                    setCursor(previous.at(-1) ?? '');
                    setPrevious((value) => value.slice(0, -1));
                    setLoading(true);
                    setFailure('');
                  }}
                >
                  {t('files.connections.previous')}
                </Action>
                <Action
                  variant="secondary"
                  disabled={!page.nextCursor}
                  onPress={() => {
                    setPrevious((value) => [...value, cursor]);
                    setCursor(page.nextCursor);
                    setLoading(true);
                    setFailure('');
                  }}
                >
                  {t('files.connections.next')}
                </Action>
              </div>
            </>
          ) : null}
        </section>
        <section className="mt-6 rounded-panel border border-border bg-surface p-4 sm:p-6">
          <h2 className="text-lg font-semibold">{t('files.connections.guideTitle')}</h2>
          <div className="my-4 flex flex-wrap gap-2" aria-label={t('files.connections.guideTitle')}>
            {['generic', 'windows', 'ios'].map((value) => (
              <Action
                key={value}
                variant={guide === value ? 'primary' : 'secondary'}
                onPress={() => setGuide(value)}
              >
                {t(`files.connections.guides.${value}.title`)}
              </Action>
            ))}
          </div>
          <p className="leading-7">{t(`files.connections.guides.${guide}.body`)}</p>
          <p className="mt-3 text-sm text-ink-muted">{t('files.connections.guideLimits')}</p>
          <p className="mt-2 text-sm text-ink-muted">{t('files.connections.proxyHint')}</p>
        </section>
        {creating && page ? (
          <CreateConnectionDialog
            policy={page}
            onClose={() => setCreating(false)}
            onIssued={issuedValue}
          />
        ) : null}
        {target ? (
          <ChangeConnectionDialog
            key={target.connection.id + target.action}
            {...target}
            onClose={() => setTarget(undefined)}
            onChanged={refresh}
            onIssued={issuedValue}
          />
        ) : null}
        {issued ? (
          <IssuedConnectionDialog value={issued} onClose={() => setIssued(undefined)} />
        ) : null}
      </Page>
    </>
  );
}
