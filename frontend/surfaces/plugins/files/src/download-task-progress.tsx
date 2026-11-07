import { useFrontendTranslation } from '@clouddrive/i18n';
import { ProgressMeter } from '@clouddrive/ui-adapter/progress-meter';
import type { OfflineDownload } from '../../../src/files/downloads';
import { formatFileBytes as bytes } from '../../../src/files/format';

export function DownloadTaskProgress({
  task,
}: {
  task: Pick<OfflineDownload, 'declaredBytes' | 'receivedBytes' | 'rateBytesPerSecond' | 'state'>;
}) {
  const { t } = useFrontendTranslation();
  const percentage =
    task.declaredBytes === null
      ? undefined
      : task.declaredBytes === 0
        ? task.state === 'completed'
          ? 100
          : 0
        : Math.min(100, (task.receivedBytes / task.declaredBytes) * 100);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-between gap-2 text-xs text-ink-muted">
        <span>
          {bytes(task.receivedBytes)} /{' '}
          {task.declaredBytes === null
            ? t('files.downloads.unknownSize')
            : bytes(task.declaredBytes)}
        </span>
        <span>{bytes(Math.round(task.rateBytesPerSecond))}/s</span>
      </div>
      {percentage === undefined ? null : (
        <ProgressMeter value={Math.round(percentage)} label={t('files.downloads.received')} />
      )}
    </div>
  );
}
