'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import type { WebFileApplicationItem } from '../../../src/files/file-applications';
import { FilesError, type FileEntry } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import { webFilePreviewURL } from '../../../src/files/web-file-preview';

export function WebFilePreviewDialog({
  entry,
  application,
  onClose,
}: {
  entry: FileEntry;
  application: WebFileApplicationItem;
  onClose: () => void;
}) {
  const port = useFiles();
  const { locale, t } = useFrontendTranslation();
  const zh = locale.startsWith('zh');
  const [target, setTarget] = useState<{ url: string; newTab: boolean }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController>(null);
  useEffect(() => () => request.current?.abort(), []);
  const oversized = application.maxBytes > 0 && entry.sizeBytes > application.maxBytes;
  async function launch() {
    if (loading || !application.origin || oversized) return;
    setLoading(true);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    try {
      if (new URL(application.origin).origin === window.location.origin)
        throw new FilesError('unsupported');
      const preview = await port.launchWebFilePreview(entry, application, controller.signal);
      if (preview.origin !== application.origin) throw new FilesError('conflict');
      const url = webFilePreviewURL(
        preview,
        window.location.origin,
        document.documentElement.dataset.theme === 'dark',
      );
      if (!controller.signal.aborted) setTarget({ url, newTab: preview.newTab });
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(t(`files.errors.${cause instanceof FilesError ? cause.code : 'unavailable'}`));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  return (
    <DialogSurface
      isOpen
      title={application.name}
      triggerLabel={application.name}
      description={entry.name}
      cancelLabel={t('files.close')}
      {...(target && !target.newTab ? { size: 'cover', layout: 'workspace' } : {})}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div className="space-y-4">
        <p>
          {zh ? '接收文件的站点' : 'File recipient'} <strong>{application.origin}</strong>
        </p>
        {!target ? (
          <>
            <p>
              {zh
                ? '继续后，此站点可通过五分钟有效的地址读取当前文件内容。'
                : 'Continuing allows this site to read the current file through a link valid for five minutes.'}
            </p>
            {oversized ? (
              <p role="alert">
                {zh
                  ? '文件超过此应用的大小限制。'
                  : 'The file exceeds this application’s size limit.'}
              </p>
            ) : null}
            {error ? <p role="alert">{error}</p> : null}
            <Action
              disabled={loading || oversized || !application.origin}
              loading={loading}
              onPress={() => void launch()}
            >
              {zh ? '允许并继续' : 'Allow and continue'}
            </Action>
          </>
        ) : (
          <>
            {!target.newTab ? (
              <iframe
                title={application.name}
                src={target.url}
                sandbox="allow-forms allow-scripts allow-same-origin"
                referrerPolicy="no-referrer"
                className="w-full border-0"
                style={{ height: '65dvh' }}
              />
            ) : null}
            <a
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline"
            >
              {zh ? '在新标签页打开' : 'Open in a new tab'}
            </a>
          </>
        )}
      </div>
    </DialogSurface>
  );
}
