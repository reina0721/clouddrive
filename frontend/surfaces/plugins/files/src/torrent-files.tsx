'use client';
import { useEffect, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField } from '@clouddrive/ui-adapter/form-field';
import { useDownloads } from '../../../src/files/runtime';
import { FilesError } from '../../../src/files/model';
import type { OfflineDownload, TorrentDetail } from '../../../src/files/downloads';
import { formatFileBytes as bytes } from '../../../src/files/format';

/** TorrentFiles 只消费受限元数据视图；文件和引擎路径始终留在服务端。 */
export default function TorrentFiles({
  task,
  onSaved,
}: Readonly<{ task: OfflineDownload; onSaved(): void }>) {
  const port = useDownloads(),
    { t } = useFrontendTranslation();
  const [view, setView] =
    useState<Readonly<{ detail: TorrentDetail; chosen: readonly number[] }>>();
  const [failure, setFailure] = useState(''),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void port
      .torrentDetail(task, controller.signal)
      .then((detail) => {
        if (controller.signal.aborted) return;
        setView((previous) => ({
          detail,
          chosen:
            previous?.detail.task.id === detail.task.id
              ? previous.chosen
              : detail.files.filter((file) => file.selected).map((file) => file.index),
        }));
        setFailure('');
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
        setLoading(false);
      });
    return () => controller.abort();
  }, [port, task, refresh, t]);
  const detail = view?.detail,
    canSelect = Boolean(detail?.canSelect && !loading && !failure && !saving);
  const chosenBytes =
    detail?.files.reduce(
      (total, file) => total + (view?.chosen.includes(file.index) ? file.sizeBytes : 0),
      0,
    ) ?? 0;
  function choose(indexes: readonly number[]) {
    setView((value) => (value ? { ...value, chosen: indexes } : value));
  }
  return (
    <section className="space-y-3" aria-label={t('files.downloads.torrentFiles')}>
      <h2 className="font-semibold">{t('files.downloads.torrentFiles')}</h2>
      <p className="text-sm text-ink-muted">{t('files.downloads.torrentSelectionHint')}</p>
      {failure ? (
        <p role="alert" className="text-danger">
          {failure}
        </p>
      ) : null}
      {loading ? <p role="status">{t('files.downloads.loading')}</p> : null}
      {!loading && !detail?.files.length ? (
        <p role="status">{t('files.downloads.metadataWaiting')}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Action
          variant="quiet"
          disabled={saving}
          onPress={() => {
            setLoading(true);
            setRefresh((value) => value + 1);
          }}
        >
          {t('files.downloads.refresh')}
        </Action>
        {detail?.canSelect ? (
          <>
            <Action
              variant="secondary"
              disabled={!canSelect}
              onPress={() => choose(detail.files.map((file) => file.index))}
            >
              {t('files.downloads.allFiles')}
            </Action>
            <Action variant="quiet" disabled={!canSelect} onPress={() => choose([])}>
              {t('files.downloads.clearSelection')}
            </Action>
          </>
        ) : null}
      </div>
      {detail?.files.length ? (
        <>
          <p className="text-sm text-ink-muted">
            {t('files.downloads.fileSelection', {
              selected: detail.canSelect ? (view?.chosen.length ?? 0) : detail.task.selectedCount,
              total: detail.files.length,
            })}{' '}
            ·{' '}
            {bytes(
              detail.canSelect ? chosenBytes : (detail.task.declaredBytes ?? detail.totalBytes),
            )}
          </p>
          <ul className="max-h-80 space-y-2 overflow-auto">
            {detail.files.map((file) => (
              <li key={file.index} className="rounded-control border border-border p-3">
                <CheckboxField
                  label={file.path}
                  checked={
                    detail.canSelect ? (view?.chosen.includes(file.index) ?? false) : file.selected
                  }
                  disabled={!canSelect}
                  onCheckedChange={(checked) =>
                    choose(
                      checked
                        ? [...new Set([...(view?.chosen ?? []), file.index])]
                        : (view?.chosen ?? []).filter((index) => index !== file.index),
                    )
                  }
                />
                <p className="mt-1 text-xs text-ink-muted">{bytes(file.sizeBytes)}</p>
              </li>
            ))}
          </ul>
          {detail.canSelect ? (
            <Action
              disabled={!canSelect || !view?.chosen.length}
              onPress={() => {
                if (!view?.chosen.length) return;
                setSaving(true);
                void port
                  .selectTorrent(detail.task, view.chosen)
                  .then((changed) => {
                    setView({ ...view, detail: { ...detail, task: changed, canSelect: false } });
                    onSaved();
                  })
                  .catch((error: unknown) => {
                    setFailure(
                      t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
                    );
                  })
                  .finally(() => setSaving(false));
              }}
            >
              {t('files.downloads.startSelected')}
            </Action>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
