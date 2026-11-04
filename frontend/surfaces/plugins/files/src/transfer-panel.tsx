'use client';
import { useEffect, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField, SelectField } from '@clouddrive/ui-adapter/form-field';
import { ProgressMeter } from '@clouddrive/ui-adapter/progress-meter';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { FilesError, type FileListing } from '../../../src/files/model';
import {
  transferMatches,
  type TransferFilter,
  type TransferItem,
} from '../../../src/files/transfers';
import { useFiles, useTransfers, useTransferSnapshot } from '../../../src/files/runtime';
import { Cloud } from '../../../src/files/icons';
import { FileLink } from './file-link';

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  return `${(value / 1024 ** 3).toFixed(1)} GiB`;
}
const compactItemCount = 8;

export function TransferPanel({ compact = false }: Readonly<{ compact?: boolean }>) {
  const port = useTransfers(),
    files = useFiles(),
    snapshot = useTransferSnapshot();
  const { t } = useFrontendTranslation();
  const [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<TransferItem>(),
    [parent, setParent] = useState(''),
    [name, setName] = useState('');
  const [directory, setDirectory] = useState<FileListing>(),
    [targetFailure, setTargetFailure] = useState('');
  const errorText = (error: unknown) =>
    t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`);
  useEffect(() => {
    let current = true;
    void port.refresh(compact ? 'active' : '').catch((error) => {
      if (current)
        setNotice(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
    });
    return () => {
      current = false;
    };
  }, [port, compact, t]);
  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    void files
      .list(
        { parent, category: '', search: '', trash: false, sort: 'name', desc: false },
        controller.signal,
      )
      .then((value) => {
        if (!controller.signal.aborted) setDirectory(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setTargetFailure(
            t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
          );
      });
    return () => controller.abort();
  }, [target, parent, files, t]);
  function changeParent(id: string) {
    setDirectory(undefined);
    setTargetFailure('');
    setParent(id);
  }
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setNotice('');
    try {
      await action();
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function confirmTarget() {
    if (!target) return;
    setBusy(true);
    setTargetFailure('');
    try {
      await port.retarget(target.id, parent, name);
      setTarget(undefined);
    } catch (error) {
      setTargetFailure(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  function failureText(code: string) {
    if (['staging', 'checksum', 'destination', 'storage'].includes(code))
      return t(`files.transferFailure.${code}`);
    return t(
      `files.errors.${['unavailable', 'unauthenticated', 'forbidden', 'missing', 'conflict', 'quota', 'large', 'busy', 'unsupported', 'invalid', 'locked', 'canceled', 'expired'].includes(code) ? code : 'unavailable'}`,
    );
  }
  const visible = compact
    ? snapshot.items.slice(-compactItemCount)
    : snapshot.items.filter((item) => transferMatches(item, snapshot.filter));
  if (
    compact &&
    !snapshot.items.length &&
    !snapshot.loading &&
    !snapshot.failure &&
    !notice &&
    !snapshot.persistenceFailure
  )
    return null;
  return (
    <section
      aria-label={t('files.uploads')}
      className="min-w-0 rounded-panel border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{t('files.uploads')}</h2>
        <div className="flex flex-wrap gap-2">
          {compact ? (
            <FileLink target="transfers" className="text-sm font-semibold text-brand">
              {t('files.transferCenter')}
            </FileLink>
          ) : null}
          <Action
            size="sm"
            variant="quiet"
            disabled={busy || snapshot.loading}
            onPress={() => {
              void act(() => port.refresh(snapshot.filter));
            }}
          >
            {t('files.refresh')}
          </Action>
          <Action
            size="sm"
            variant="secondary"
            disabled={busy}
            onPress={() => {
              void act(port.pauseAll);
            }}
          >
            {t('files.pauseAll')}
          </Action>
          <Action
            size="sm"
            variant="secondary"
            disabled={busy}
            onPress={() => {
              void act(port.resumeAll);
            }}
          >
            {t('files.resumeAll')}
          </Action>
        </div>
      </div>
      {!compact ? (
        <div className="mt-4 max-w-xs">
          <SelectField
            label={t('files.transferFilter')}
            value={snapshot.filter}
            onValueChange={(value) => {
              void act(() => port.refresh(value as TransferFilter));
            }}
            options={[
              { value: '', label: t('files.transferAll') },
              { value: 'active', label: t('files.transferActive') },
              { value: 'attention', label: t('files.transferAttention') },
              { value: 'completed', label: t('files.transferCompleted') },
            ]}
          />
        </div>
      ) : null}
      {snapshot.loading ? (
        <p role="status" className="mt-3 text-sm text-ink-muted">
          {t('files.loading')}
        </p>
      ) : null}
      {notice || snapshot.failure ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {notice || failureText(snapshot.failure)}
        </p>
      ) : null}
      {snapshot.persistenceFailure ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {t('files.pendingPersistenceFailure')}
        </p>
      ) : null}
      {!visible.length && !snapshot.loading && !snapshot.failure ? (
        <StateSurface
          state="empty"
          icon={<Cloud />}
          title={t('files.noTransfers')}
          description={t('files.transferResumeHint')}
        />
      ) : null}
      <ul className="mt-3 divide-y divide-border">
        {visible.map((item) => {
          const hashing = item.phase === 'hashing';
          const amount = hashing ? item.hashBytes : item.confirmedBytes;
          const percent =
            item.phase === 'completed'
              ? 100
              : item.sizeBytes
                ? Math.round((amount / item.sizeBytes) * 1000) / 10
                : 0;
          const active = ['waiting', 'hashing', 'uploading', 'publishing'].includes(item.phase);
          const finished = ['completed', 'canceled', 'expired'].includes(item.phase);
          return (
            <li key={item.id} className="min-w-0 space-y-3 py-4" data-transfer-id={item.id}>
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
                <span className="min-w-0 flex-1 break-words font-medium">{item.name}</span>
                {item.replacementId ? (
                  <span className="text-xs text-warning">{t('files.versions.upload')}</span>
                ) : null}
                <span role="status" className="text-sm text-ink-muted">
                  {t(`files.transferPhase.${item.phase}`)}
                </span>
              </div>
              {item.sizeKnown ? (
                <ProgressMeter
                  value={percent}
                  label={t(hashing ? 'files.hashingProgress' : 'files.uploadProgress', {
                    name: item.name,
                  })}
                />
              ) : (
                <p role="status" className="text-sm text-ink-muted">
                  {t('files.unknownTransferSize')}
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-muted">
                <span>
                  {bytes(item.confirmedBytes)} /{' '}
                  {item.sizeKnown ? bytes(item.sizeBytes) : t('files.unknownTransferSize')}
                </span>
                {item.phase === 'uploading' && item.bytesPerSecond > 0 ? (
                  <span>
                    {t('files.transferSpeed', { speed: bytes(item.bytesPerSecond) })}
                    {item.remainingSeconds === null
                      ? ''
                      : ` · ${t('files.transferETA', { seconds: item.remainingSeconds })}`}
                  </span>
                ) : null}
                <span className="min-w-0 break-words">
                  {t('files.transferDestination')}{' '}
                  {item.destinationAvailable ? (
                    <button
                      type="button"
                      className="text-brand underline"
                      onClick={() => {
                        files.openFolder(item.parentId);
                      }}
                    >
                      {item.destinationPath === '/' ? t('files.nav') : item.destinationPath}
                    </button>
                  ) : (
                    t(
                      item.serverId
                        ? 'files.transferUnavailableDestination'
                        : 'files.transferPreparingDestination',
                    )
                  )}
                </span>
              </div>
              {item.failure ? (
                <p role="alert" className="text-sm text-danger">
                  {failureText(item.failure)}
                </p>
              ) : null}
              {item.phase === 'needs-source' ? (
                <p className="text-xs text-ink-muted">{t('files.transferResumeHint')}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {active ? (
                  <Action
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onPress={() => {
                      void act(() => port.pause(item.id));
                    }}
                  >
                    {t('files.pause')}
                  </Action>
                ) : null}
                {item.source === 'tus' &&
                ['paused', 'failed', 'attention'].includes(item.phase) &&
                (item.hasSource || item.confirmedBytes === item.sizeBytes) ? (
                  <Action
                    size="sm"
                    disabled={busy}
                    onPress={() => {
                      void act(() => port.resume(item.id));
                    }}
                  >
                    {t(
                      item.confirmedBytes === item.sizeBytes
                        ? 'files.finishTransfer'
                        : 'files.resume',
                    )}
                  </Action>
                ) : null}
                {item.source === 'tus' && !finished && !active ? (
                  <Action
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onPress={() => {
                      void act(() => port.reselect(item.id));
                    }}
                  >
                    {t('files.reselectSource')}
                  </Action>
                ) : null}
                {item.source === 'tus' &&
                !item.replacementId &&
                item.phase === 'attention' &&
                item.confirmedBytes === item.sizeBytes ? (
                  <Action
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onPress={() => {
                      setTarget(item);
                      changeParent(item.parentId);
                      setName(item.name);
                      setTargetFailure('');
                    }}
                  >
                    {t('files.retargetTransfer')}
                  </Action>
                ) : null}
                {!finished ? (
                  <Action
                    size="sm"
                    variant="quiet"
                    disabled={busy}
                    onPress={() => {
                      void act(() => port.cancel(item.id));
                    }}
                  >
                    {t('files.cancel')}
                  </Action>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      {!compact && snapshot.nextCursor ? (
        <Action
          variant="secondary"
          disabled={busy || snapshot.loading}
          onPress={() => {
            void act(() => port.refresh(snapshot.filter, snapshot.nextCursor));
          }}
        >
          {t('files.nextTransferPage')}
        </Action>
      ) : null}
      {target ? (
        <DialogSurface
          triggerLabel={t('files.retargetTransfer')}
          title={t('files.retargetTransfer')}
          description={t('files.retargetHint')}
          cancelLabel={t('files.cancel')}
          confirmLabel={t('files.finishTransfer')}
          isOpen
          onOpenChange={(open) => {
            if (!open) setTarget(undefined);
          }}
          confirmDisabled={!directory || !name.trim() || busy}
          {...(targetFailure ? { failureMessage: targetFailure } : {})}
          onConfirm={confirmTarget}
        >
          <TextField
            label={t('files.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="mt-4 space-y-3">
            <Action size="sm" variant="quiet" onPress={() => changeParent('')}>
              {t('files.nav')}
            </Action>
            {directory ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {directory.breadcrumbs.map((entry) => (
                    <Action
                      key={entry.id}
                      size="sm"
                      variant="quiet"
                      onPress={() => changeParent(entry.id)}
                    >
                      {entry.name}
                    </Action>
                  ))}
                </div>
                <ul>
                  {directory.items
                    .filter((entry) => entry.kind === 'folder')
                    .map((entry) => (
                      <li key={entry.id}>
                        <Action size="sm" variant="quiet" onPress={() => changeParent(entry.id)}>
                          {entry.name}
                        </Action>
                      </li>
                    ))}
                </ul>
              </>
            ) : null}
          </div>
        </DialogSurface>
      ) : null}
    </section>
  );
}
