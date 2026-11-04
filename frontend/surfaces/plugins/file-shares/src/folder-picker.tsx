'use client';
import { useEffect, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { usePublicFiles } from '../../../src/files/runtime';
import { FilesError, type PublicFileListing, type PublicFileEntry } from '../../../src/files/model';
import { initialPublicQuery } from './public-entry';

export function PublicFolderPicker({
  root,
  value,
  onChange,
}: Readonly<{ root: PublicFileEntry; value: string; onChange(id: string): void }>) {
  const port = usePublicFiles(),
    { t } = useFrontendTranslation();
  const [listing, setListing] = useState<PublicFileListing>(),
    [failure, setFailure] = useState(''),
    [revision, setRevision] = useState(0),
    [page, setPage] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    void port
      .entries({ ...initialPublicQuery, parent: value, page }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setListing(result);
          setFailure('');
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setListing(undefined);
          setFailure(
            t(`publicFiles.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
          );
        }
      });
    return () => controller.abort();
  }, [port, value, page, revision, t]);
  const browse = (id: string) => {
    setListing(undefined);
    setPage(1);
    onChange(id);
  };
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{t('publicFiles.collaboration.destination')}</p>
      <nav aria-label={t('publicFiles.path')} className="flex flex-wrap gap-2">
        <Action variant="quiet" onPress={() => browse(root.id)}>
          {root.name}
        </Action>
        {listing?.breadcrumbs
          .filter((entry) => entry.id !== root.id)
          .map((entry) => (
            <Action key={entry.id} variant="quiet" onPress={() => browse(entry.id)}>
              {entry.name}
            </Action>
          ))}
      </nav>
      {failure ? (
        <p role="alert" className="text-danger">
          {failure}
        </p>
      ) : null}
      {!listing && !failure ? (
        <p role="status">{t('publicFiles.collaboration.folderLoading')}</p>
      ) : null}
      {listing?.items
        .filter((entry) => entry.kind === 'folder')
        .map((entry) => (
          <Action key={entry.id} variant="secondary" onPress={() => browse(entry.id)}>
            {entry.name}
          </Action>
        ))}
      {listing && !listing.items.some((entry) => entry.kind === 'folder') ? (
        <p className="text-sm text-ink-muted">{t('publicFiles.collaboration.folderEmpty')}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Action
          variant="quiet"
          disabled={page === 1}
          onPress={() => {
            setListing(undefined);
            setPage((value) => value - 1);
          }}
        >
          {t('publicFiles.collaboration.previous')}
        </Action>
        <Action
          variant="quiet"
          disabled={!listing || page * listing.pageSize >= listing.total}
          onPress={() => {
            setListing(undefined);
            setPage((value) => value + 1);
          }}
        >
          {t('publicFiles.collaboration.next')}
        </Action>
        <Action variant="quiet" onPress={() => setRevision((value) => value + 1)}>
          {t('publicFiles.collaboration.refreshFolders')}
        </Action>
      </div>
    </div>
  );
}
