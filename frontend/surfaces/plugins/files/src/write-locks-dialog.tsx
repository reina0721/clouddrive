'use client';
import { useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import type { FileWriteLock, FileConnection } from '../../../src/files/connections';
import { FilesError } from '../../../src/files/model';
import { useConnections } from '../../../src/files/runtime';
import { useFileTime } from './use-file-time';

export default function WriteLocksDialog({
  connections,
  onClose,
}: {
  connections: readonly FileConnection[];
  onClose: () => void;
}) {
  const port = useConnections(),
    { t } = useFrontendTranslation(),
    time = useFileTime();
  const [locks, setLocks] = useState<readonly FileWriteLock[]>([]);
  const [loading, setLoading] = useState(true),
    [failure, setFailure] = useState('');
  const [revision, setRevision] = useState(0),
    [target, setTarget] = useState<FileWriteLock>();
  const [releaseFailure, setReleaseFailure] = useState('');
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void port
      .listWriteLocks(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setLocks(value);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFailure(
            t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [port, revision, t]);
  function refresh() {
    setFailure('');
    setLoading(true);
    setRevision((value) => value + 1);
  }
  return (
    <>
      <DialogSurface
        isOpen
        triggerLabel={t('files.locks.title')}
        title={t('files.locks.title')}
        description={t('files.locks.description')}
        cancelLabel={t('files.close')}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Action variant="secondary" disabled={loading} onPress={refresh}>
          {t('files.refresh')}
        </Action>
        {loading ? (
          <p role="status">{t('files.locks.loading')}</p>
        ) : failure ? (
          <p role="alert" className="text-danger">
            {failure}
          </p>
        ) : locks.length === 0 ? (
          <p role="status">{t('files.locks.empty')}</p>
        ) : (
          <ul className="space-y-4">
            {locks.map((lock) => (
              <li key={lock.id} className="min-w-0 rounded-panel border border-border p-4">
                <p className="break-all font-semibold">{lock.path}</p>
                <dl className="mt-2 text-sm">
                  <dt>{t('files.locks.connection')}</dt>
                  <dd className="break-all">
                    {lock.protocol === 'wopi'
                      ? 'WOPI'
                      : (connections.find((connection) => connection.id === lock.connectionId)
                          ?.name ?? lock.connectionId)}
                  </dd>
                  <dt>{t('files.locks.depth')}</dt>
                  <dd>{t('files.locks.' + (lock.depth === '0' ? 'self' : 'subtree'))}</dd>
                  <dt>{t('files.locks.expires')}</dt>
                  <dd className="break-all">{time.full(lock.expiresAt)}</dd>
                </dl>
                <Action
                  variant="secondary"
                  onPress={() => {
                    setReleaseFailure('');
                    setTarget(lock);
                  }}
                >
                  {t('files.locks.release')}
                  <span className="sr-only"> {lock.path}</span>
                </Action>
              </li>
            ))}
          </ul>
        )}
      </DialogSurface>
      {target ? (
        <DialogSurface
          isOpen
          triggerLabel={t('files.locks.releaseTitle')}
          title={t('files.locks.releaseTitle')}
          description={t('files.locks.releaseDescription')}
          cancelLabel={t('files.cancel')}
          confirmLabel={t('files.locks.release')}
          failureMessage={releaseFailure}
          onOpenChange={(open) => {
            if (!open) setTarget(undefined);
          }}
          onConfirm={async () => {
            if (!lifetime.current) throw new FilesError('canceled');
            try {
              await port.releaseWriteLock(target, lifetime.current.signal);
              refresh();
            } catch (error) {
              if (!lifetime.current.signal.aborted)
                setReleaseFailure(
                  t(
                    error instanceof FilesError && error.code === 'conflict'
                      ? 'files.locks.conflict'
                      : 'files.errors.' +
                          (error instanceof FilesError ? error.code : 'unavailable'),
                  ),
                );
              throw error;
            }
          }}
        >
          <p className="break-all">{target.path}</p>
        </DialogSurface>
      ) : null}
    </>
  );
}
