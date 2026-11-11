'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { FilesError, isHlsPlaylist, type FileEntry } from '../../../src/files/model';
import {
  fileApplicationChoice,
  fileApplicationDevice,
  type FileApplicationID,
  type FileApplicationPolicy,
  type WebFileApplicationItem,
} from '../../../src/files/file-applications';
import { fileIconExtension } from '../../../src/files/icon-rules';
import type { FileDocumentProps } from '../../../src/files/pdf-contract';
import { useFiles, useFileNavigation, usePlayFileAudio } from '../../../src/files/runtime';
import {
  compatibleFileApplications,
  configuredFileApplications,
  type FileReaderSession,
  type MediaReaderSession,
} from './file-reader-session';

export function useFileReader({
  scope,
  entries,
  maxMediaBytes,
  maxTextBytes,
  pdfReaderLimits,
  onNotice,
  onChanged,
}: {
  scope: string;
  entries: readonly FileEntry[];
  maxMediaBytes: number | undefined;
  maxTextBytes: number | undefined;
  pdfReaderLimits: FileDocumentProps['limits'] | undefined;
  onNotice: (message: string) => void;
  onChanged: () => void;
}) {
  const port = useFiles();
  const navigation = useFileNavigation();
  const playAudio = usePlayFileAudio();
  const { t } = useFrontendTranslation();
  const pending = useRef<AbortController | undefined>(undefined);
  const sequence = useRef(0);
  const [snapshot, setSnapshot] = useState<{ identity: number; session: FileReaderSession }>();
  const commit = useCallback((session: FileReaderSession | undefined) => {
    const identity = ++sequence.current;
    setSnapshot((current) =>
      session
        ? {
            identity:
              session.kind === 'selecting' &&
              current?.session.kind === 'selecting' &&
              current.session.scope === session.scope &&
              current.session.entry.id === session.entry.id
                ? current.identity
                : identity,
            session,
          }
        : undefined,
    );
  }, []);
  const updateMedia = useCallback((update: (current: MediaReaderSession) => MediaReaderSession) => {
    setSnapshot((current) =>
      current?.session.kind === 'media'
        ? { ...current, session: update(current.session) }
        : current,
    );
  }, []);
  // 查询提交只取消尚未完成的打开意图；已打开编辑器继续拥有自己的未保存内容。
  useEffect(() => () => pending.current?.abort(), [scope]);
  const cancelPending = useCallback(() => {
    pending.current?.abort();
    setSnapshot((current) => (current?.session.kind === 'selecting' ? undefined : current));
  }, []);
  const close = useCallback(() => {
    pending.current?.abort();
    commit(undefined);
  }, [commit]);
  const errorText = useCallback(
    (error: unknown) =>
      t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
    [t],
  );
  const moveImage = (delta: -1 | 1) => {
    updateMedia((current) => {
      if (!current.album) return current;
      const { entries, index } = current.album;
      const next = index + delta;
      const entry = entries[next];
      if (!entry) return current;
      return { ...current, entry, album: { entries, index: next }, savedImageVersion: false };
    });
  };
  async function refreshPublishedImage(target: FileEntry, signal: AbortSignal) {
    const { entry } = await port.detail(target.id, signal);
    signal.throwIfAborted();
    if (
      entry.id !== target.id ||
      entry.contentRevision <= target.contentRevision ||
      entry.trashedAt !== null
    )
      throw new FilesError('conflict');
    updateMedia((current) => {
      if (current.entry.id !== target.id) return current;
      if (!current.album) return { ...current, entry, savedImageVersion: true };
      return {
        ...current,
        entry,
        savedImageVersion: true,
        album: {
          ...current.album,
          entries: current.album.entries.map((item) => (item.id === entry.id ? entry : item)),
        },
      };
    });
    onChanged();
  }
  const launchApplication = useCallback(
    (entry: FileEntry, application: FileApplicationID, policy?: FileApplicationPolicy) => {
      if (
        application === 'audio' &&
        playAudio &&
        maxMediaBytes !== undefined &&
        entry.trashedAt === null
      ) {
        commit(undefined);
        playAudio(entry, maxMediaBytes);
        return;
      }
      switch (application) {
        case 'archive':
          commit({ kind: 'archive', entry });
          return;
        case 'pdf':
          // 文件列表刷新时保留已打开的阅读会话和本次读取预算。
          if (pdfReaderLimits) commit({ kind: 'pdf', entry, limits: pdfReaderLimits });
          else onNotice(t('files.errors.unavailable'));
          return;
        case 'epub':
          commit({ kind: 'epub', entry });
          return;
        case 'drawio':
          if (maxTextBytes === undefined || entry.trashedAt !== null)
            onNotice(t('files.errors.unavailable'));
          else commit({ kind: 'drawio', request: { entry }, maxBytes: maxTextBytes });
          return;
        case 'markdown':
        case 'text':
          if (maxTextBytes === undefined) onNotice(t('files.errors.unavailable'));
          else
            commit({
              kind: 'text',
              request:
                application === 'text'
                  ? { mode: 'edit', entry, code: true }
                  : { mode: 'edit', entry, reading: true },
              maxBytes: maxTextBytes,
            });
          return;
        case 'image':
        case 'audio':
        case 'video':
          // 上传完成会刷新列表，已打开的预览继续持有本次读取预算与文件。
          if (maxMediaBytes === undefined) onNotice(t('files.errors.unavailable'));
          else {
            const device = fileApplicationDevice(window.innerWidth);
            const neighbors =
              application === 'image' && policy && entry.trashedAt === null
                ? entries.filter(
                    (item) =>
                      item.kind === 'file' &&
                      item.parentId === entry.parentId &&
                      item.trashedAt === null &&
                      item.sizeBytes <= maxMediaBytes &&
                      compatibleFileApplications(item, false).includes('image') &&
                      fileApplicationChoice(
                        policy,
                        ['image'],
                        ['image'],
                        fileIconExtension(item.name),
                        device,
                      ).options.includes('image'),
                  )
                : undefined;
            const position = neighbors?.findIndex((item) => item.id === entry.id) ?? -1;
            commit({
              kind: 'media',
              entry,
              maxBytes: maxMediaBytes,
              ...(application === 'image' && entry.trashedAt === null
                ? {
                    album:
                      position >= 0 && neighbors
                        ? { entries: neighbors, index: position }
                        : { entries: [entry], index: 0 },
                  }
                : {}),
              ...(application === 'video' && entry.trashedAt === null && isHlsPlaylist(entry)
                ? { videoPlaylist: true }
                : {}),
            });
          }
          return;
      }
    },
    [t, maxMediaBytes, maxTextBytes, pdfReaderLimits, playAudio, entries, commit, onNotice],
  );
  const open = useCallback(
    async (entry: FileEntry, requested?: 'choose' | 'archive') => {
      pending.current?.abort();
      if (entry.kind === 'shortcut') {
        navigation.openShortcut(entry.id);
        return;
      }
      if (entry.kind !== 'file') return;
      const controller = new AbortController();
      pending.current = controller;
      commit({ kind: 'selecting', scope, entry, visible: requested === 'choose' });
      try {
        const policy = await port.readActiveFileApplications(controller.signal);
        if (controller.signal.aborted) return;
        const extension = fileIconExtension(entry.name);
        const device = fileApplicationDevice(window.innerWidth);
        const choice = fileApplicationChoice(
          policy,
          compatibleFileApplications(
            entry,
            policy.items.some(
              (item) =>
                item.id === 'text' && !item.customExtensions && item.extensions.includes(extension),
            ),
          ),
          configuredFileApplications(entry),
          extension,
          device,
        );
        const webOptions =
          requested === 'archive'
            ? []
            : policy.webItems.filter(
                (app) =>
                  app.enabled &&
                  app.origin &&
                  app.extensions.includes(extension) &&
                  (app.platform === 'all' || app.platform === device),
              );
        const selectedWeb = requested
          ? undefined
          : (webOptions.find((app) => app.id === choice.defaultApp) ??
            (webOptions.length === 1 && choice.options.length === 0 ? webOptions[0] : undefined));
        if (selectedWeb) {
          commit({ kind: 'web', entry, application: selectedWeb });
          return;
        }
        const selected =
          requested === 'archive'
            ? choice.options.find((id) => id === requested)
            : requested === 'choose'
              ? undefined
              : webOptions.length
                ? choice.options.find((id) => id === choice.defaultApp)
                : choice.automatic;
        if (selected) launchApplication(entry, selected, policy);
        else
          commit({
            kind: 'selecting',
            scope,
            visible: true,
            entry,
            options: requested === 'archive' ? [] : choice.options,
            webOptions,
            policy,
          });
      } catch (error) {
        if (!controller.signal.aborted)
          commit({ kind: 'selecting', scope, visible: true, entry, error: errorText(error) });
      }
    },
    [port, navigation, launchApplication, errorText, scope, commit],
  );

  function edit(entry: FileEntry) {
    pending.current?.abort();
    if (maxTextBytes === undefined) {
      onNotice(t('files.errors.unavailable'));
      return;
    }
    commit({ kind: 'text', request: { mode: 'edit', entry }, maxBytes: maxTextBytes });
  }
  const download = useCallback(
    async (entry: FileEntry) => {
      try {
        await port.download(entry);
      } catch (error) {
        onNotice(errorText(error));
      }
    },
    [port, onNotice, errorText],
  );
  const session = snapshot?.session;
  return {
    identity: snapshot?.identity ?? 0,
    session: session?.kind === 'selecting' && session.scope !== scope ? undefined : session,
    open,
    cancelPending,
    edit,
    close,
    download,
    moveImage,
    refreshPublishedImage,
    choose(application: FileApplicationID) {
      if (
        session?.kind === 'selecting' &&
        session.scope === scope &&
        pending.current &&
        !pending.current.signal.aborted
      )
        launchApplication(session.entry, application, session.policy);
    },
    chooseWeb(application: WebFileApplicationItem) {
      if (
        session?.kind === 'selecting' &&
        session.scope === scope &&
        pending.current &&
        !pending.current.signal.aborted
      )
        commit({ kind: 'web', entry: session.entry, application });
    },
    saved: () => {
      onNotice(t('files.operationDone'));
      onChanged();
    },
    changed: onChanged,
  };
}
export type FileReaderController = ReturnType<typeof useFileReader>;
