'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { fileApplicationDevice } from '../../../src/files/file-applications';
import { FilesError, type FileEntry } from '../../../src/files/model';
import { useDrawioEndpoint, useFiles } from '../../../src/files/runtime';
import {
  drawioEndpoint,
  drawioHandshakeTimeoutMs,
  drawioMessage,
  emptyDrawio,
  validDrawioXML,
} from './drawio-protocol';

export type DrawioRequest = { entry: FileEntry } | { parentId: string; extension: string };

export default function DrawioDialog({
  request,
  maxBytes,
  onClose,
  onSaved,
}: {
  request: DrawioRequest;
  maxBytes: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, locale } = useFrontendTranslation();
  const chinese = locale.startsWith('zh');
  const port = useFiles();
  const configuredEndpoint = useDrawioEndpoint();
  const [name, setName] = useState('');
  const [original, setOriginal] = useState('entry' in request ? undefined : emptyDrawio);
  const [readFailure, setReadFailure] = useState('');
  const [readAttempt, setReadAttempt] = useState(0);
  const [provider, setProvider] = useState<URL>();
  const [started, setStarted] = useState(false);
  const [draft, setDraft] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const [discard, setDiscard] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const loaded = useRef(false);
  const pending = useRef(false);
  const entry = useRef<FileEntry>(undefined);
  const savedXML = useRef<string>(undefined);
  const workingXML = useRef<string>(undefined);
  const endpoint =
    typeof window === 'undefined'
      ? undefined
      : drawioEndpoint(
          configuredEndpoint,
          window.location.origin,
          chinese ? 'zh' : 'en',
          fileApplicationDevice(window.innerWidth),
        );
  const title = 'entry' in request ? request.entry.name : t('files.newDrawio');
  const sourceName = 'entry' in request ? request.entry.name : name.trim();
  const fileName =
    'entry' in request || sourceName.toLowerCase().endsWith('.' + request.extension)
      ? sourceName
      : sourceName + '.' + request.extension;
  const invalidXML = chinese
    ? '图表须为有效的 UTF-8 Draw.io XML。'
    : 'The diagram must contain valid UTF-8 Draw.io XML.';
  const savedLabel = chinese ? '图表已保存。' : 'Diagram saved.';
  const errorText = (error: unknown) =>
    t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable'));

  const reportReadFailure = useEffectEvent((error: unknown) => {
    setReadFailure(errorText(error));
  });
  useEffect(() => {
    if (!('entry' in request)) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const detail = await port.detail(request.entry.id, controller.signal);
        if (!detail.textEditable) throw new FilesError('unsupported');
        if (detail.entry.sizeBytes > maxBytes) throw new FilesError('large');
        const source = await port.openTextSource(detail.entry, controller.signal);
        if (controller.signal.aborted) return;
        const xml = source.decode('utf-8').text;
        if (!validDrawioXML(xml)) throw new FilesError('invalid');
        entry.current = detail.entry;
        savedXML.current = xml;
        setOriginal(xml);
      } catch (error) {
        if (!controller.signal.aborted) reportReadFailure(error);
      }
    })();
    return () => controller.abort();
  }, [request, port, maxBytes, readAttempt]);

  function requestClose(confirmation: boolean) {
    if (pending.current) return;
    const changed = workingXML.current !== undefined && workingXML.current !== savedXML.current;
    if (confirmation || changed) setDiscard(true);
    else onClose();
  }

  async function persist(xml: string, closeAfter: boolean) {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setFailure('');
    setNotice('');
    try {
      const current = entry.current;
      entry.current = current
        ? await port.replaceText(current.id, current.contentRevision, xml)
        : 'parentId' in request
          ? await port.createText(request.parentId, fileName, xml)
          : undefined;
      if (!entry.current) throw new FilesError('unavailable');
      savedXML.current = xml;
      const hasNewerDraft = workingXML.current !== xml;
      setDraft(hasNewerDraft ? workingXML.current : undefined);
      if (!hasNewerDraft) {
        if (provider)
          frame.current?.contentWindow?.postMessage(
            JSON.stringify({ action: 'status', message: savedLabel, modified: false }),
            provider.origin,
          );
      }
      setNotice(
        hasNewerDraft
          ? chinese
            ? '图表版本已保存，仍有未保存的修改。'
            : 'Diagram version saved. Newer changes remain unsaved.'
          : savedLabel,
      );
      if ('entry' in request || !hasNewerDraft) onSaved();
      if ('entry' in request && closeAfter && !hasNewerDraft) onClose();
    } catch (error) {
      setFailure(errorText(error));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const receive = useEffectEvent((event: MessageEvent<unknown>) => {
    const window = frame.current?.contentWindow;
    if (!window || !provider || original === undefined) return;
    const message = drawioMessage(event, window, provider.origin, maxBytes);
    if (!message) return;
    const post = (payload: object) => window.postMessage(JSON.stringify(payload), provider.origin);
    if (message.event === 'configure' && !loaded.current) {
      post({ action: 'configure', config: { suppressNewWindows: true } });
    } else if (message.event === 'init' && !loaded.current) {
      loaded.current = true;
      setStarted(true);
      post({
        action: 'load',
        xml: workingXML.current ?? savedXML.current ?? original,
        title: fileName,
        autosave: 1,
      });
    } else if (loaded.current && message.event === 'exit') {
      requestClose(message.modified);
    } else if (loaded.current && 'xml' in message) {
      const { xml } = message;
      const tooLarge = port.textBytes(xml) > maxBytes;
      if (!tooLarge && !validDrawioXML(xml)) {
        setFailure(invalidXML);
        return;
      }
      workingXML.current = xml;
      const changed = xml !== savedXML.current;
      setDraft(changed ? xml : undefined);
      if (tooLarge) setFailure(t('files.errors.large'));
      else if (message.event === 'save') {
        if (changed) void persist(xml, message.exit);
        else if (message.exit) requestClose(false);
      }
    }
  });
  const timedOut = useEffectEvent(() => {
    if (loaded.current) return;
    setProvider(undefined);
    setFailure(
      chinese ? 'Draw.io 未完成加载，可以重试。' : 'Draw.io did not finish loading. Try again.',
    );
  });
  useEffect(() => {
    if (!provider) return;
    const listener = (event: MessageEvent<unknown>) => receive(event);
    window.addEventListener('message', listener);
    const timer = window.setTimeout(() => timedOut(), drawioHandshakeTimeoutMs);
    const warn = (event: BeforeUnloadEvent) => {
      if (!loaded.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('message', listener);
      window.removeEventListener('beforeunload', warn);
      window.clearTimeout(timer);
    };
  }, [provider]);

  function downloadDraft() {
    if (draft === undefined) return;
    const anchor = document.createElement('a');
    const url = URL.createObjectURL(new Blob([draft], { type: 'application/xml' }));
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  const load = () => {
    if (!endpoint) return;
    loaded.current = false;
    setStarted(false);
    setFailure('');
    setProvider(endpoint);
  };
  const discardTitle = chinese ? '放弃未保存的图表？' : 'Discard unsaved diagram changes?';
  return (
    <>
      <DialogSurface
        isOpen
        title={title}
        triggerLabel={title}
        description={chinese ? 'Draw.io 在线图表工作区' : 'Draw.io diagram workspace'}
        cancelLabel={t('files.close')}
        size="cover"
        layout="workspace"
        onOpenChange={(open) => {
          if (!open) requestClose(started);
        }}
      >
        <div className="flex h-full min-h-0 flex-col gap-2">
          {'parentId' in request ? (
            <TextField
              label={t('files.name')}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          ) : null}
          {readFailure ? <p role="alert">{readFailure}</p> : null}
          {failure ? <p role="alert">{failure}</p> : null}
          {notice || saving ? (
            <p role="status">{saving ? (chinese ? '正在保存图表…' : 'Saving diagram…') : notice}</p>
          ) : null}
          {!provider && endpoint ? (
            <p className="text-sm text-ink-muted">
              {chinese
                ? '加载后，图表内容和文件名将发送给 '
                : 'Loading sends the diagram and filename to '}
              <strong>{endpoint.origin}</strong>
              {chinese ? '。' : '.'}
            </p>
          ) : null}
          {!provider && !endpoint ? (
            <p role="alert">
              {chinese
                ? 'Draw.io 地址无效，或与文件站点使用相同主机名。'
                : 'The Draw.io address is invalid or uses the file site hostname.'}
            </p>
          ) : null}
          <div className="flex shrink-0 flex-wrap gap-2">
            {!provider && endpoint && original !== undefined ? (
              <Action variant="primary" disabled={!sourceName} onPress={load}>
                {failure
                  ? chinese
                    ? '重试加载 Draw.io'
                    : 'Retry loading Draw.io'
                  : chinese
                    ? '加载 Draw.io'
                    : 'Load Draw.io'}
              </Action>
            ) : null}
            {readFailure ? (
              <Action
                variant="secondary"
                onPress={() => {
                  setReadFailure('');
                  setReadAttempt((attempt) => attempt + 1);
                }}
              >
                {t('files.retry')}
              </Action>
            ) : null}
            {'entry' in request ? (
              <Action
                variant="secondary"
                onPress={() => {
                  void port
                    .download(request.entry)
                    .catch((error: unknown) => setFailure(errorText(error)));
                }}
              >
                {t('files.download')}
              </Action>
            ) : null}
            {draft !== undefined ? (
              <Action variant="secondary" onPress={downloadDraft}>
                {chinese ? '下载草稿' : 'Download draft'}
              </Action>
            ) : null}
          </div>
          {(provider && !started) || (!provider && original === undefined && !readFailure) ? (
            <p role="status">{t('files.mediaLoading')}</p>
          ) : null}
          {provider ? (
            <iframe
              ref={frame}
              src={provider.href}
              title={chinese ? 'Draw.io 绘图编辑器' : 'Draw.io diagram editor'}
              sandbox="allow-scripts allow-same-origin allow-downloads"
              referrerPolicy="no-referrer"
              className="min-h-0 w-full flex-1 rounded-control border border-border"
            />
          ) : null}
        </div>
      </DialogSurface>
      {discard ? (
        <DialogSurface
          isOpen
          title={discardTitle}
          triggerLabel={discardTitle}
          description={
            chinese
              ? '退出将清除本次编辑中的未保存修改。'
              : 'Exiting clears unsaved changes from this session.'
          }
          cancelLabel={t('files.cancel')}
          confirmLabel={chinese ? '放弃修改' : 'Discard changes'}
          onOpenChange={(open) => {
            if (!open) setDiscard(false);
          }}
          onConfirm={onClose}
        >
          {draft !== undefined ? (
            <Action variant="secondary" onPress={downloadDraft}>
              {chinese ? '下载草稿' : 'Download draft'}
            </Action>
          ) : null}
        </DialogSurface>
      ) : null}
    </>
  );
}
