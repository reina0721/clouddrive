'use client';
import { Cloud } from '../../../src/files/icons';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useFileTime } from './use-file-time';
import { Page, PageHeader, Section } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { lazy, Suspense, useEffect, useState } from 'react';
import {
  FilesError,
  type FileShare,
  type ShareListing,
  type ShareQuery,
} from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import { sharePermissionPreset } from '../../../src/files/sharing';
import { ShareDetailDrawer, ShareSettingsDialog } from './share-settings-dialog';

const DirectLinksDialog = lazy(() => import('./direct-links-dialog'));

export function MySharesPage() {
  const port = useFiles(),
    { t } = useFrontendTranslation();
  const time = useFileTime();
  const [query, setQuery] = useState<ShareQuery>({
      search: '',
      state: '',
      sort: 'newest',
      page: 1,
    }),
    [search, setSearch] = useState('');
  const [listing, setListing] = useState<ShareListing>(),
    [loading, setLoading] = useState(true),
    [failure, setFailure] = useState(''),
    [notice, setNotice] = useState(''),
    [revision, setRevision] = useState(0);
  const [opening, setOpening] = useState(false);
  const [directLinks, setDirectLinks] = useState(false);
  const [editing, setEditing] = useState<FileShare>(),
    [detail, setDetail] = useState<FileShare>(),
    [confirmation, setConfirmation] =
      useState<Readonly<{ kind: 'revoke' | 'state'; share: FileShare; enabled: boolean }>>();
  const errorText = (error: unknown) =>
    t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`);
  const refresh = () => {
    setLoading(true);
    setFailure('');
    setRevision((value) => value + 1);
  };
  const filter = (patch: Partial<ShareQuery>) => {
    setLoading(true);
    setFailure('');
    setQuery((value) => ({ ...value, ...patch, page: patch.page ?? 1 }));
  };
  useEffect(() => {
    const controller = new AbortController();
    void port
      .shares(query, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setListing(value);
          setFailure('');
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [port, query, revision, t]);
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
          actions={
            <>
              <Action variant="secondary" disabled={loading} onPress={refresh}>
                {t('files.refresh')}
              </Action>
              <Action variant="secondary" onPress={() => setDirectLinks(true)}>
                {t('files.directLinks.manage')}
              </Action>
            </>
          }
          description={t('files.collaboration.managementHint')}
        />
        <Section title={t('files.collaboration.links')} contentInset>
          <form
            className="my-5 flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              filter({ search });
            }}
          >
            <div className="min-w-48 flex-1">
              <TextField
                label={t('files.collaboration.search')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="w-full sm:w-52">
              <SelectField
                label={t('files.collaboration.stateFilter')}
                value={query.state}
                onValueChange={(state) => filter({ state: state as ShareQuery['state'] })}
                options={(['', 'active', 'paused', 'expired', 'revoked'] as const).map((value) => ({
                  value,
                  label: t(`files.collaboration.filters.${value || 'all'}`),
                }))}
              />
            </div>
            <div className="w-full sm:w-40">
              <SelectField
                label={t('files.collaboration.sort')}
                value={query.sort}
                onValueChange={(sort) => filter({ sort: sort as ShareQuery['sort'] })}
                options={(['newest', 'oldest', 'name'] as const).map((value) => ({
                  value,
                  label: t(`files.collaboration.sorts.${value}`),
                }))}
              />
            </div>
            <Action type="submit" variant="secondary">
              {t('files.collaboration.searchAction')}
            </Action>
          </form>
          {listing?.metadataLimited ? (
            <p role="status" className="mb-4 text-sm text-ink-muted">
              {t('files.collaboration.metadataLimited')}
            </p>
          ) : null}
          {notice ? (
            <p role="status" className="mb-4 text-sm text-ink-muted">
              {notice}
            </p>
          ) : null}
          {failure ? (
            <StateSurface
              state="error"
              icon={<Cloud />}
              title={failure}
              description={t('files.collaboration.refreshHint')}
            />
          ) : loading ? (
            <StateSurface
              state="loading"
              icon={<Cloud />}
              title={t('files.loading')}
              description={t('files.collaboration.managementHint')}
            />
          ) : !listing?.items.length ? (
            <StateSurface
              state="empty"
              icon={<Cloud />}
              title={t('files.noShares')}
              description={t('files.noSharesHint')}
            />
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {listing.items.map((share) => (
                <li
                  key={share.id}
                  data-share-id={share.id}
                  className="min-w-0 rounded-panel border border-border bg-surface p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="break-words font-semibold">
                        {share.title || share.name || t('files.collaboration.unavailableName')}
                      </h2>
                      {share.title ? (
                        <p className="mt-1 break-words text-sm text-ink-muted">{share.name}</p>
                      ) : null}
                    </div>
                    <span className="rounded-control bg-surface-muted px-2 py-1 text-xs font-semibold">
                      {t(`files.shareStatuses.${share.status}`)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-ink-muted">
                    {t(`files.collaboration.presets.${sharePermissionPreset(share.permissions)}`)}
                    {share.hasPassword ? ` · ${t('files.shareProtected')}` : ''}
                  </p>
                  <p className="mt-2 text-sm text-ink-muted">
                    {t('files.shareExpires')}: {time.full(share.expiresAt)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Action variant="quiet" size="sm" onPress={() => setDetail(share)}>
                      {t('files.collaboration.details')}
                    </Action>
                    {share.status !== 'revoked' ? (
                      <Action
                        variant="quiet"
                        size="sm"
                        disabled={opening}
                        onPress={() => {
                          if (opening) return;
                          setOpening(true);
                          setFailure('');
                          void port
                            .readShare(share.id)
                            .then(setEditing)
                            .catch((error: unknown) => setFailure(errorText(error)))
                            .finally(() => setOpening(false));
                        }}
                      >
                        {t('files.collaboration.settings')}
                      </Action>
                    ) : null}
                    {share.status === 'active' ? (
                      <>
                        <Action
                          variant="quiet"
                          size="sm"
                          onPress={() => {
                            setNotice('');
                            void port
                              .copyShareLink(share.token)
                              .then(() => setNotice(t('files.linkCopied')))
                              .catch((error: unknown) => setFailure(errorText(error)));
                          }}
                        >
                          {t('files.copyLink')}
                        </Action>
                        <a
                          className="inline-flex items-center rounded-control px-3 py-2 text-sm font-semibold text-brand"
                          href={port.shareLink(share.token)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {t('files.collaboration.visitorPreview')}
                        </a>
                      </>
                    ) : null}
                    {share.status !== 'revoked' && share.status !== 'expired' ? (
                      <Action
                        variant="quiet"
                        size="sm"
                        onPress={() => {
                          setFailure('');
                          setConfirmation({ kind: 'state', share, enabled: !share.enabled });
                        }}
                      >
                        {t(
                          share.enabled
                            ? 'files.collaboration.pause'
                            : 'files.collaboration.resume',
                        )}
                      </Action>
                    ) : null}
                    <Action
                      variant="danger"
                      size="sm"
                      disabled={share.status === 'revoked'}
                      onPress={() => {
                        setFailure('');
                        setConfirmation({ kind: 'revoke', share, enabled: false });
                      }}
                    >
                      {t('files.revokeShare')}
                    </Action>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {listing ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <Action
                variant="quiet"
                disabled={loading || query.page <= 1}
                onPress={() => filter({ page: query.page - 1 })}
              >
                {t('files.collaboration.previous')}
              </Action>
              <p className="text-sm text-ink-muted">
                {t('files.collaboration.pageCount', { page: listing.page, total: listing.total })}
              </p>
              <Action
                variant="quiet"
                disabled={loading || query.page * listing.pageSize >= listing.total}
                onPress={() => filter({ page: query.page + 1 })}
              >
                {t('files.collaboration.next')}
              </Action>
            </div>
          ) : null}
        </Section>
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
          <DialogSurface
            triggerLabel={t(
              confirmation.kind === 'revoke'
                ? 'files.revokeShare'
                : confirmation.enabled
                  ? 'files.collaboration.resume'
                  : 'files.collaboration.pause',
            )}
            title={t(
              confirmation.kind === 'revoke'
                ? 'files.revokeShare'
                : confirmation.enabled
                  ? 'files.collaboration.resume'
                  : 'files.collaboration.pause',
            )}
            description={t(
              confirmation.kind === 'revoke'
                ? 'files.collaboration.revokeHint'
                : confirmation.enabled
                  ? 'files.collaboration.resumeHint'
                  : 'files.collaboration.pauseHint',
            )}
            cancelLabel={t('files.cancel')}
            confirmLabel={t(
              confirmation.kind === 'revoke' ? 'files.confirm' : 'files.collaboration.confirm',
            )}
            failureMessage={failure}
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
                setFailure(errorText(error));
                throw error;
              }
            }}
          >
            {confirmation.share.title || confirmation.share.name}
          </DialogSurface>
        ) : null}
      </Page>
    </>
  );
}
