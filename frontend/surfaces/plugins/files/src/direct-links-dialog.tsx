'use client';
import { useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import type { DirectLink, DirectLinkPage, DirectLinkResult } from '../../../src/files/direct-links';
import { FilesError, type FileEntry } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';

const zh = {
  disclosure: '任何取得直链的人都可读取此文件，无需登录。直链会访问该文件的当前版本。',
  manageHint: '撤销后旧链接立即停止接受新请求。',
  issue: '生成直链',
  copy: '复制链接',
  copyDownload: '复制下载链接',
  copyAll: '复制全部链接',
  copied: '链接已复制',
  suspended: '文件在回收站中，直链暂停',
  unavailable: '文件不可用',
  limit: '直链数量已达上限',
  empty: '还没有直链',
  revoke: '撤销',
  confirmRevoke: '确认撤销',
  revoked: '直链已撤销',
  back: '上一页',
  next: '下一页',
};
const en: typeof zh = {
  disclosure: 'Anyone with the link can read the current version of this file without signing in.',
  manageHint: 'Revoked links stop accepting new requests immediately.',
  issue: 'Generate links',
  copy: 'Copy link',
  copyDownload: 'Copy download link',
  copyAll: 'Copy all links',
  copied: 'Links copied',
  suspended: 'File is in trash. Link suspended.',
  unavailable: 'File unavailable',
  limit: 'Direct link limit reached',
  empty: 'No direct links yet',
  revoke: 'Revoke',
  confirmRevoke: 'Confirm revoke',
  revoked: 'Direct link revoked',
  back: 'Previous page',
  next: 'Next page',
};

export default function DirectLinksDialog({
  entries,
  onClose,
}: {
  entries?: readonly FileEntry[];
  onClose: () => void;
}) {
  const files = useFiles();
  const { t, locale } = useFrontendTranslation();
  const labels = locale.startsWith('zh') ? zh : en;
  const managing = entries === undefined;
  const title = t(managing ? 'files.directLinks.manage' : 'files.directLinks.get');
  const lifetime = useRef<AbortController>(null);
  const [result, setResult] = useState<DirectLinkResult[]>();
  const [page, setPage] = useState(1);
  const [listing, setListing] = useState<DirectLinkPage>();
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!managing) return;
    const controller = new AbortController();
    void files.listDirectLinks(page, controller.signal).then(
      (response) => {
        if (!controller.signal.aborted) setListing(response);
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setFailure(
            t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')),
          );
      },
    );
    return () => controller.abort();
  }, [files, managing, page, reload, t]);

  async function perform(action: (signal: AbortSignal) => Promise<void>) {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted) return;
    setPending(true);
    setFailure('');
    setNotice('');
    try {
      await action(signal);
    } catch (error) {
      if (!signal.aborted)
        setFailure(t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')));
    } finally {
      if (!signal.aborted) setPending(false);
    }
  }

  const copy = (urls: readonly string[]) =>
    perform(async (signal) => {
      await files.copyDirectLinks(urls);
      if (!signal.aborted) setNotice(labels.copied);
    });

  function revoke(link: DirectLink) {
    void perform(async (signal) => {
      await files.revokeDirectLink(link.id, signal);
      if (signal.aborted) return;
      setConfirm(undefined);
      setNotice(labels.revoked);
      setListing(undefined);
      if (listing?.items.length === 1 && page > 1) setPage(page - 1);
      else setReload((value) => value + 1);
    });
  }
  const links =
    listing?.items ?? result?.flatMap((item) => ('link' in item ? [item.link] : [])) ?? [];
  return (
    <DialogSurface
      isOpen
      triggerLabel={title}
      title={title}
      description={managing ? labels.manageHint : labels.disclosure}
      cancelLabel={t('files.close')}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <div className="min-w-0 space-y-4">
        {entries && !result ? (
          <>
            <ul className="space-y-1">
              {entries.map((entry) => (
                <li key={entry.id} className="break-all text-sm">
                  {entry.name}
                </li>
              ))}
            </ul>
            <Action
              loading={pending}
              onPress={() => {
                void perform(async (signal) => {
                  const response = await files.issueDirectLinks(
                    entries.map((entry) => entry.id),
                    signal,
                  );
                  if (!signal.aborted) setResult(response);
                });
              }}
            >
              {labels.issue}
            </Action>
          </>
        ) : null}
        {managing && !listing && !failure ? <p role="status">{t('files.loading')}</p> : null}
        {listing?.total === 0 ? <p>{labels.empty}</p> : null}
        {failure ? (
          <div className="space-y-2">
            <p className="text-sm text-danger" role="alert">
              {failure}
            </p>
            {managing && !listing ? (
              <Action
                variant="secondary"
                onPress={() => {
                  setFailure('');
                  setReload((value) => value + 1);
                }}
              >
                {t('files.retry')}
              </Action>
            ) : null}
          </div>
        ) : null}
        {notice ? <p role="status">{notice}</p> : null}
        {result && links.length > 1 ? (
          <Action
            variant="secondary"
            disabled={pending}
            onPress={() => void copy(links.map((link) => files.directLink(link.token)))}
          >
            {labels.copyAll}
          </Action>
        ) : null}
        {result?.map((item) =>
          'failure' in item ? (
            <p key={item.entryId} className="break-all text-sm text-danger">
              {entries?.find((entry) => entry.id === item.entryId)?.name ?? ''} ·{' '}
              {labels[item.failure]}
            </p>
          ) : null,
        )}
        {links.map((link) => {
          const url = files.directLink(link.token);
          return (
            <div key={link.id} className="space-y-2 rounded-control border border-border p-2">
              <p className="break-all text-sm font-medium">{link.name || labels.unavailable}</p>
              {link.active ? (
                <a
                  className="break-all text-sm text-brand"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {url}
                </a>
              ) : (
                <p className="text-sm text-ink-muted">{labels.suspended}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {link.active ? (
                  <>
                    <Action
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onPress={() => void copy([url])}
                    >
                      {labels.copy}
                    </Action>
                    <Action
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onPress={() => void copy([files.directLink(link.token, 'download')])}
                    >
                      {labels.copyDownload}
                    </Action>
                  </>
                ) : null}
                {managing ? (
                  confirm === link.id ? (
                    <>
                      <Action
                        size="sm"
                        variant="danger"
                        disabled={pending}
                        onPress={() => revoke(link)}
                      >
                        {labels.confirmRevoke}
                      </Action>
                      <Action
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onPress={() => setConfirm(undefined)}
                      >
                        {t('files.cancel')}
                      </Action>
                    </>
                  ) : (
                    <Action
                      size="sm"
                      variant="quiet"
                      disabled={pending}
                      onPress={() => setConfirm(link.id)}
                    >
                      {labels.revoke}
                    </Action>
                  )
                ) : null}
              </div>
            </div>
          );
        })}
        {listing && (page > 1 || listing.total > listing.pageSize) ? (
          <div className="flex flex-wrap gap-2">
            <Action
              size="sm"
              variant="secondary"
              disabled={page <= 1 || pending}
              onPress={() => {
                setListing(undefined);
                setPage(page - 1);
              }}
            >
              {labels.back}
            </Action>
            <Action
              size="sm"
              variant="secondary"
              disabled={page * listing.pageSize >= listing.total || pending}
              onPress={() => {
                setListing(undefined);
                setPage(page + 1);
              }}
            >
              {labels.next}
            </Action>
          </div>
        ) : null}
      </div>
    </DialogSurface>
  );
}
