'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { HiddenField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import {
  maxWOPIEditBytes,
  type WebFileApplicationItem,
} from '../../../src/files/file-applications';
import { fileIconExtension } from '../../../src/files/icon-rules';
import { FilesError, type FileEntry } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import { webFilePreviewURL } from '../../../src/files/web-file-preview';

type PreviewTarget = {
  url: string;
  newTab: boolean;
  wopi?: { token: string; expiresAtMilliseconds: number };
};

function WOPILaunch({
  target,
  title,
  newTabLabel,
}: {
  target: PreviewTarget & { wopi: NonNullable<PreviewTarget['wopi']> };
  title: string;
  newTabLabel: string;
}) {
  const frameName = useId();
  const embeddedForm = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  useEffect(() => {
    if (embeddedForm.current && !submitted.current) {
      submitted.current = true;
      embeddedForm.current.submit();
    }
  }, []);
  const credentials = (
    <>
      <HiddenField name="access_token" value={target.wopi.token} />
      <HiddenField name="access_token_ttl" value={target.wopi.expiresAtMilliseconds} />
    </>
  );
  return (
    <>
      <form method="post" action={target.url} target="_blank" rel="noopener noreferrer">
        {credentials}
        <Action type="submit" variant="secondary">
          {newTabLabel}
        </Action>
      </form>
      {!target.newTab ? (
        <>
          <iframe
            name={frameName}
            title={title}
            sandbox="allow-forms allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
            className="w-full border-0"
            style={{ height: '65dvh' }}
          />
          <form ref={embeddedForm} method="post" action={target.url} target={frameName}>
            {credentials}
          </form>
        </>
      ) : null}
    </>
  );
}

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
  const [target, setTarget] = useState<PreviewTarget>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController>(null);
  useEffect(() => () => request.current?.abort(), []);
  const oversized = application.maxBytes > 0 && entry.sizeBytes > application.maxBytes;
  const editable = application.editExtensions?.includes(fileIconExtension(entry.name));
  const canEdit = editable && entry.sizeBytes <= maxWOPIEditBytes;
  async function launch(mode?: 'edit') {
    if (loading || !application.origin || oversized) return;
    setLoading(true);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    try {
      if (new URL(application.origin).origin === window.location.origin)
        throw new FilesError('unsupported');
      const preview = await port.launchWebFilePreview(entry, application, controller.signal, mode);
      if (preview.origin !== application.origin) throw new FilesError('conflict');
      if (application.protocol === 'wopi') {
        if (!preview.wopi) throw new FilesError('unavailable');
        const action = new URL(preview.wopi.actionUrl);
        if (
          action.protocol !== 'https:' ||
          action.origin !== new URL(preview.origin).origin ||
          action.username ||
          action.password
        )
          throw new FilesError('unsupported');
        const source = new URL(
          '/wopi/files/' + encodeURIComponent(entry.id),
          window.location.origin,
        );
        action.searchParams.set('WOPISrc', source.href);
        if (!controller.signal.aborted)
          setTarget({
            url: action.href,
            newTab: preview.newTab,
            wopi: {
              token: preview.token,
              expiresAtMilliseconds: preview.wopi.expiresAtMilliseconds,
            },
          });
        return;
      }
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
            {editable ? (
              <>
                <p className="text-sm text-ink-muted">
                  {zh
                    ? '编辑会允许该站点在两小时内保存此文件的新版本，单次保存最多 8 MiB。'
                    : 'Editing allows this site to save new versions of this file for two hours, up to 8 MiB per save.'}
                </p>
                <Action
                  variant="secondary"
                  disabled={loading || oversized || !canEdit || !application.origin}
                  onPress={() => void launch('edit')}
                >
                  {zh ? '允许编辑' : 'Allow editing'}
                </Action>
              </>
            ) : null}
          </>
        ) : target.wopi ? (
          <WOPILaunch
            target={{ ...target, wopi: target.wopi }}
            title={application.name}
            newTabLabel={zh ? '在新标签页打开' : 'Open in a new tab'}
          />
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
