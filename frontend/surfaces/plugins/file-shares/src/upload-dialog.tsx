'use client';
import { useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { ProgressMeter } from '@clouddrive/ui-adapter/progress-meter';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { usePublicFiles } from '../../../src/files/runtime';
import {
  FilesError,
  type PublicUploadCandidate,
  type PublicUploadProgress,
} from '../../../src/files/model';
import { formatFileBytes } from '../../../src/files/format';

type UploadRow = Readonly<{
  candidate: PublicUploadCandidate;
  progress?: PublicUploadProgress;
  error?: string;
  done?: boolean;
}>;
export function PublicUploadDialog({
  parent,
  limit,
  onClose,
  onSaved,
}: Readonly<{ parent: string; limit: number; onClose(): void; onSaved(): void }>) {
  const port = usePublicFiles(),
    { t } = useFrontendTranslation();
  const [rows, setRows] = useState<readonly UploadRow[]>([]),
    [busy, setBusy] = useState(false),
    [choosing, setChoosing] = useState(false),
    [failure, setFailure] = useState('');
  const controller = useRef<AbortController | undefined>(undefined),
    sources = useRef<readonly PublicUploadCandidate[]>([]),
    mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
      for (const source of sources.current) port.releaseUpload(source.id);
    };
  }, [port]);
  const errorText = (error: unknown) =>
    t(`publicFiles.errors.${error instanceof FilesError ? error.code : 'unavailable'}`);
  const choose = async () => {
    setChoosing(true);
    try {
      const chosen = await port.chooseUploads(parent);
      if (!mounted.current) {
        chosen.forEach((source) => port.releaseUpload(source.id));
        return;
      }
      sources.current = [...sources.current, ...chosen];
      setRows((value) => [...value, ...chosen.map((candidate) => ({ candidate }))]);
      setFailure('');
    } catch (error) {
      if (mounted.current) setFailure(errorText(error));
    } finally {
      if (mounted.current) setChoosing(false);
    }
  };
  const start = async () => {
    if (controller.current) return;
    const run = new AbortController();
    controller.current = run;
    setBusy(true);
    setFailure('');
    try {
      for (const row of rows) {
        if (row.done || run.signal.aborted) continue;
        const id = row.candidate.id;
        setRows((value) =>
          value.map((item) => (item.candidate.id === id ? { candidate: item.candidate } : item)),
        );
        try {
          await port.upload(
            row.candidate,
            parent,
            (progress) => {
              if (mounted.current)
                setRows((value) =>
                  value.map((item) => (item.candidate.id === id ? { ...item, progress } : item)),
                );
            },
            run.signal,
          );
          if (mounted.current) {
            setRows((value) =>
              value.map((item) => (item.candidate.id === id ? { ...item, done: true } : item)),
            );
            onSaved();
          }
        } catch (error) {
          if (mounted.current)
            setRows((value) =>
              value.map((item) =>
                item.candidate.id === id ? { ...item, error: errorText(error) } : item,
              ),
            );
        } finally {
          if (!mounted.current) port.releaseUpload(id);
        }
      }
    } finally {
      controller.current = undefined;
      if (mounted.current) setBusy(false);
    }
  };
  const title = t('publicFiles.collaboration.upload');
  return (
    <DialogSurface
      triggerLabel={title}
      title={title}
      description={t('publicFiles.collaboration.uploadHint')}
      isOpen
      onOpenChange={(open) => {
        if (!open) {
          controller.current?.abort();
          onClose();
        }
      }}
      cancelLabel={t('publicFiles.collaboration.close')}
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          {t('publicFiles.collaboration.uploadLimit', { count: limit })}
        </p>
        <p className="text-sm">{t('publicFiles.collaboration.uploadLocation')}</p>
        {failure ? (
          <p role="alert" className="text-danger">
            {failure}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Action
            variant="secondary"
            disabled={busy || rows.length >= limit}
            loading={choosing}
            onPress={() => void choose()}
          >
            {t('publicFiles.collaboration.chooseMore')}
          </Action>
          <Action
            disabled={busy || choosing || !rows.some((row) => !row.done)}
            onPress={() => void start()}
          >
            {t('publicFiles.collaboration.startUpload')}
          </Action>
          {busy ? (
            <Action variant="secondary" onPress={() => controller.current?.abort()}>
              {t('publicFiles.collaboration.cancelUpload')}
            </Action>
          ) : null}
        </div>
        {rows.map((row) => (
          <div
            key={row.candidate.id}
            data-upload-candidate={row.candidate.id}
            className="space-y-2 rounded-control border border-border p-3"
          >
            <p className="break-words font-medium">{row.candidate.name}</p>
            <p className="text-sm text-ink-muted">{formatFileBytes(row.candidate.sizeBytes)}</p>
            {row.progress ? (
              <>
                <ProgressMeter
                  label={t(`publicFiles.collaboration.uploadPhases.${row.progress.phase}`)}
                  value={
                    row.progress.totalBytes === 0
                      ? row.done
                        ? 100
                        : 0
                      : (row.progress.processedBytes / row.progress.totalBytes) * 100
                  }
                />
                <p className="text-sm">
                  {t('publicFiles.collaboration.bytesProgress', {
                    received: formatFileBytes(row.progress.processedBytes),
                    total: formatFileBytes(row.progress.totalBytes),
                  })}
                </p>
              </>
            ) : null}
            {row.done ? <p role="status">{t('publicFiles.collaboration.uploadDone')}</p> : null}
            {row.error ? (
              <p role="alert" className="text-danger">
                {row.error}
              </p>
            ) : null}
            <Action
              variant="quiet"
              disabled={busy}
              onPress={() => {
                port.releaseUpload(row.candidate.id);
                sources.current = sources.current.filter(
                  (source) => source.id !== row.candidate.id,
                );
                setRows((value) => value.filter((item) => item.candidate.id !== row.candidate.id));
              }}
            >
              {t('publicFiles.collaboration.removeUpload')}
            </Action>
          </div>
        ))}
      </div>
    </DialogSurface>
  );
}
