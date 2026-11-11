'use client';
import { Cloud, RefreshCw, Share2 } from '../../../src/files/icons';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { SelectField } from '@clouddrive/ui-adapter/form-field';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { ConfirmDialog } from '@clouddrive/ui-adapter/overlays';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FilesError,
  type FileShare,
  type ShareListing,
  type ShareQuery,
  type FilesPort,
} from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import { ShareDetailDrawer, ShareSettingsDialog } from './share-settings-dialog';
import { ShareListItem, type ShareListAction, type ShareListFeedback } from './share-list-item';
import { readShareCatalogQuery, shareCatalogHref } from './share-catalog-query';
import { FileLink } from './file-link';

const DirectLinksDialog = lazy(() => import('./direct-links-dialog'));

export function MySharesPage() {
  const port = useFiles(),
    { t, locale } = useFrontendTranslation();
  const router = useRouter();
  const params = useSearchParams().toString();
  const query = useMemo(() => readShareCatalogQuery(new URLSearchParams(params)), [params]);
  const [draft, setDraft] = useState<{ source: string; value: string }>();
  const search = draft?.source === query.search ? draft.value : query.search;
  const [revision, setRevision] = useState(0);
  const key = shareCatalogHref('', query) + ':' + revision + ':' + locale;
  const [result, setResult] = useState<{
    port: FilesPort;
    key: string;
    listing?: ShareListing;
    failure?: string;
  }>();
  const current = result?.port === port && result.key === key ? result : undefined;
  const listing = current?.listing,
    failure = current?.failure;
  const loading = !current;
  const [feedback, setFeedback] = useState<ShareListFeedback>();
  const [opening, setOpening] = useState<string>();
  const editRequest = useRef<AbortController | null>(null);
  const copyPending = useRef(false);
  const [copying, setCopying] = useState(false);
  const [directLinks, setDirectLinks] = useState(false);
  const [editing, setEditing] = useState<FileShare>(),
    [detail, setDetail] = useState<FileShare>();
  const [confirmation, setConfirmation] = useState<{
    kind: 'revoke' | 'state';
    share: FileShare;
    enabled: boolean;
  }>();
  const [confirmationFailure, setConfirmationFailure] = useState('');
  const errorText = (error: unknown) =>
    t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`);
  const cancelOpening = useCallback(() => {
    editRequest.current?.abort();
    editRequest.current = null;
    setOpening(undefined);
  }, []);
  useEffect(() => () => editRequest.current?.abort(), [port, key]);
  const refresh = () => {
    cancelOpening();
    setFeedback(undefined);
    setRevision((value) => value + 1);
  };
  const filter = (patch: Partial<ShareQuery>) => {
    cancelOpening();
    setFeedback(undefined);
    const next = { ...query, ...patch, page: patch.page ?? 1 };
    const path = port.destinationHref('shares');
    if (shareCatalogHref(path, next) === shareCatalogHref(path, query))
      setRevision((value) => value + 1);
    else router.push(shareCatalogHref(path, next), { scroll: false });
  };
  useEffect(() => {
    const controller = new AbortController();
    void port.shares(query, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) setResult({ port, key, listing: value });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            port,
            key,
            failure: t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
          });
      },
    );
    return () => controller.abort();
  }, [port, query, key, t]);

  const act = (action: ShareListAction, share: FileShare) => {
    cancelOpening();
    if (action === 'details') {
      setDetail(share);
      return;
    }
    if (action === 'copy') {
      if (copyPending.current) return;
      copyPending.current = true;
      setCopying(true);
      setFeedback(undefined);
      void port
        .copyShareLink(share.token)
        .then(
          () => setFeedback({ shareId: share.id, error: false, message: t('files.linkCopied') }),
          (error: unknown) =>
            setFeedback({
              shareId: share.id,
              error: true,
              message: t('files.collaboration.copyFailed', { reason: errorText(error) }),
            }),
        )
        .finally(() => {
          copyPending.current = false;
          setCopying(false);
        });
      return;
    }
    setFeedback(undefined);
    if (action === 'settings') {
      const controller = new AbortController();
      editRequest.current = controller;
      setOpening(share.id);
      void port
        .readShare(share.id, controller.signal)
        .then(
          (value) => {
            if (!controller.signal.aborted) setEditing(value);
          },
          (error: unknown) => {
            if (!controller.signal.aborted)
              setFeedback({ shareId: share.id, error: true, message: errorText(error) });
          },
        )
        .finally(() => {
          if (editRequest.current === controller) {
            editRequest.current = null;
            setOpening(undefined);
          }
        });
      return;
    }
    setConfirmationFailure('');
    setConfirmation({
      kind: action === 'revoke' ? 'revoke' : 'state',
      share,
      enabled: action === 'resume',
    });
  };
  const hasFilters = Boolean(query.search || query.state);
  const outOfRange = Boolean(listing?.total && !listing.items.length && query.page > 1);
  const confirmationLabel =
    confirmation?.kind === 'revoke'
      ? t('files.revokeShare')
      : t(confirmation?.enabled ? 'files.collaboration.resume' : 'files.collaboration.pause');
  return (
    <>
      {directLinks ? (
        <Suspense>
          <DirectLinksDialog onClose={() => setDirectLinks(false)} />
        </Suspense>
      ) : null}
      <Page>
        <PageHeader
          title={t('files.myShares')}
          description={t('files.collaboration.managementHint')}
          actions={
            <>
              <IconAction label={t('files.refresh')} disabled={loading} onPress={refresh} tooltip>
                <RefreshCw className="size-5" aria-hidden="true" />
              </IconAction>
              <Action
                variant="quiet"
                onPress={() => {
                  cancelOpening();
                  setDirectLinks(true);
                }}
              >
                {t('files.directLinks.manage')}
              </Action>
              <FileLink
                target="files"
                className="inline-flex min-h-control items-center gap-2 rounded-action bg-brand px-5 text-sm font-medium text-on-brand outline-none hover:bg-brand-strong focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <Share2 className="size-4" aria-hidden="true" />
                {t('files.collaboration.shareFile')}
              </FileLink>
            </>
          }
        />
        <form
          role="search"
          aria-label={t('files.collaboration.searchShares')}
          onSubmit={(event) => {
            event.preventDefault();
            filter({ search: search.trim() });
          }}
        >
          <Toolbar
            label={t('files.collaboration.searchShares')}
            primary={
              <>
                <div className="min-w-48 flex-1">
                  <SearchBox
                    label={t('files.collaboration.search')}
                    placeholder={t('files.collaboration.search')}
                    value={search}
                    onValueChange={(value) => setDraft({ source: query.search, value })}
                  />
                </div>
                <Action type="submit" variant="quiet" size="sm">
                  {t('files.collaboration.searchAction')}
                </Action>
              </>
            }
            secondary={
              <>
                <SelectField
                  presentation="toolbar"
                  label={t('files.collaboration.stateFilter')}
                  value={query.state}
                  onValueChange={(state) => filter({ state: state as ShareQuery['state'] })}
                  options={(['', 'active', 'paused', 'expired', 'revoked'] as const).map(
                    (value) => ({
                      value,
                      label: t(`files.collaboration.filters.${value || 'all'}`),
                    }),
                  )}
                />
                <SelectField
                  presentation="toolbar"
                  label={t('files.collaboration.sort')}
                  value={query.sort}
                  onValueChange={(sort) => filter({ sort: sort as ShareQuery['sort'] })}
                  options={(['newest', 'oldest', 'name'] as const).map((value) => ({
                    value,
                    label: t(`files.collaboration.sorts.${value}`),
                  }))}
                />
              </>
            }
          />
        </form>
        {listing?.metadataLimited ? (
          <p role="status" className="text-sm text-ink-muted">
            {t('files.collaboration.metadataLimited')}
          </p>
        ) : null}
        {failure ? (
          <StateSurface
            state="error"
            announcement="urgent"
            icon={<Cloud />}
            title={failure}
            description={t('files.collaboration.refreshHint')}
            actionLabel={t('files.refresh')}
            onAction={refresh}
          />
        ) : loading ? (
          <StateSurface
            state="loading"
            icon={<Share2 />}
            title={t('files.collaboration.loadingShares')}
            description={t('files.collaboration.managementHint')}
          />
        ) : !listing?.items.length ? (
          <StateSurface
            state="empty"
            icon={<Share2 />}
            title={t(
              outOfRange
                ? 'files.collaboration.emptyPage'
                : hasFilters
                  ? 'files.collaboration.noMatches'
                  : 'files.noShares',
            )}
            description={t(
              outOfRange
                ? 'files.collaboration.emptyPageHint'
                : hasFilters
                  ? 'files.collaboration.noMatchesHint'
                  : 'files.noSharesHint',
            )}
            actionLabel={t(
              outOfRange
                ? 'files.collaboration.firstPage'
                : hasFilters
                  ? 'files.clearFileFilters'
                  : 'files.collaboration.shareFile',
            )}
            onAction={() => {
              if (outOfRange) filter({ page: 1 });
              else if (hasFilters) {
                setDraft(undefined);
                filter({ search: '', state: '' });
              } else port.navigate('files');
            }}
          />
        ) : (
          <section aria-label={t('files.collaboration.links')}>
            <p role="status" className="mb-1 text-sm text-ink-muted">
              {t('files.collaboration.resultCount', { count: listing.total })}
            </p>
            <ul className="divide-y divide-border">
              {listing.items.map((share) => (
                <ShareListItem
                  key={share.id}
                  share={share}
                  opening={opening === share.id}
                  copying={copying}
                  feedback={feedback?.shareId === share.id ? feedback : undefined}
                  visitorHref={port.shareLink(share.token)}
                  onAction={act}
                />
              ))}
            </ul>
          </section>
        )}
        {listing && listing.total > listing.pageSize ? (
          <nav
            aria-label={t('files.collaboration.pagination')}
            className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
          >
            <Action
              variant="quiet"
              disabled={query.page <= 1}
              onPress={() => filter({ page: query.page - 1 })}
            >
              {t('files.collaboration.previous')}
            </Action>
            <p className="text-sm text-ink-muted">
              {t('files.collaboration.pageCount', { page: listing.page, total: listing.total })}
            </p>
            <Action
              variant="quiet"
              disabled={query.page * listing.pageSize >= listing.total}
              onPress={() => filter({ page: query.page + 1 })}
            >
              {t('files.collaboration.next')}
            </Action>
          </nav>
        ) : null}
        {editing ? (
          <ShareSettingsDialog
            share={editing}
            onClose={() => setEditing(undefined)}
            onSaved={() => {
              setEditing(undefined);
              refresh();
            }}
          />
        ) : null}
        {detail ? <ShareDetailDrawer share={detail} onClose={() => setDetail(undefined)} /> : null}
        {confirmation ? (
          <ConfirmDialog
            triggerLabel={confirmationLabel}
            title={confirmationLabel}
            description={t(
              confirmation.kind === 'revoke'
                ? 'files.collaboration.revokeHint'
                : confirmation.enabled
                  ? 'files.collaboration.resumeHint'
                  : 'files.collaboration.pauseHint',
            )}
            impact={confirmation.share.title || confirmation.share.name}
            tone={confirmation.kind === 'revoke' ? 'danger' : 'primary'}
            cancelLabel={t('files.cancel')}
            confirmLabel={
              confirmation.kind === 'revoke'
                ? t('files.revokeShare')
                : t('files.collaboration.confirm')
            }
            failureMessage={confirmationFailure}
            isOpen
            onOpenChange={(open) => {
              if (!open) setConfirmation(undefined);
            }}
            onConfirm={async () => {
              try {
                if (confirmation.kind === 'revoke') await port.revokeShare(confirmation.share.id);
                else await port.setShareEnabled(confirmation.share, confirmation.enabled);
                setConfirmation(undefined);
                refresh();
              } catch (error) {
                setConfirmationFailure(errorText(error));
                throw error;
              }
            }}
          />
        ) : null}
      </Page>
    </>
  );
}
