'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, PageHeader, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { IconAction } from '@clouddrive/ui-adapter/icon-action';
import { SelectField } from '@clouddrive/ui-adapter/form-field';
import { MenuButton } from '@clouddrive/ui-adapter/menu-button';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Cloud, FileGlyph, MoreHorizontal, RefreshCw } from '../../../src/files/icons';
import { FilesError, type FileEntry } from '../../../src/files/model';
import type {
  NavigationPort,
  PinTarget,
  SavedShareFilter,
  ShortcutListing,
} from '../../../src/files/navigation';
import { useFileNavigation, useFiles } from '../../../src/files/runtime';
import { useWorkspaceRevision } from '../stores/workspace';
import { PinDialog } from './pinned-links';
import { SaveShortcutDialog, ShortcutActionDialog, type ShortcutAction } from './shortcut-dialogs';
import {
  readShortcutCatalogQuery,
  shortcutCatalogHref,
  type ShortcutCatalogQuery,
} from './shortcut-catalog-query';

export function SharedPage() {
  const nav = useFileNavigation(),
    files = useFiles(),
    { t, locale } = useFrontendTranslation();
  const router = useRouter();
  const params = useSearchParams().toString();
  const query = useMemo(() => readShortcutCatalogQuery(new URLSearchParams(params)), [params]);
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useWorkspaceRevision();
  const [draft, setDraft] = useState<{ source: string; value: string }>();
  const searchText = draft?.source === query.search ? draft.value : query.search;
  const href = shortcutCatalogHref(files.destinationHref('shared'), query);
  const key = href + ':' + revision + ':' + locale;
  const [result, setResult] = useState<{
    nav: NavigationPort;
    key: string;
    page?: ShortcutListing;
    failure?: string;
  }>();
  const current = result?.nav === nav && result.key === key ? result : undefined;
  const page = current?.page,
    failure = current?.failure,
    loading = !current;
  // 后退游标只来自实际读过的页。直接打开中间页时提供“第一页”，不猜测前驱。
  const [trail, setTrail] = useState<{ nav: NavigationPort; cursors: Record<string, string> }>();
  const previous = trail?.nav === nav ? trail.cursors : {};
  const [save, setSave] = useState<{ address: string }>(),
    [target, setTarget] = useState<{ entry: FileEntry; action: ShortcutAction }>(),
    [pin, setPin] = useState<PinTarget>();
  useEffect(() => {
    try {
      const address = nav.readSaveIntent();
      // 保存意图来自仅浏览器可读的片段，首次挂载后必须同步到确认对话框。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (address) setSave({ address });
    } catch (error) {
      setNotice(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
    }
  }, [nav, t]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => nav.shortcuts(query, controller.signal))
      .then((value) => {
        if (!controller.signal.aborted) setResult({ nav, key, page: value });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            nav,
            key,
            failure: t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
          });
      });
    return () => controller.abort();
  }, [nav, query, key, t]);
  const refresh = () => {
    setRevision((value) => value + 1);
  };
  const filter = (patch: Partial<ShortcutCatalogQuery>) => {
    const next = shortcutCatalogHref(files.destinationHref('shared'), {
      ...query,
      cursor: '',
      ...patch,
    });
    setDraft(undefined);
    setNotice('');
    if (next === href) refresh();
    else router.push(next, { scroll: false });
  };
  const closeSave = () => {
    nav.clearSaveIntent();
    setSave(undefined);
  };
  const hasFilters = Boolean(query.search || query.state);
  return (
    <>
      <Page>
        <PageHeader
          title={t('files.navigation.title')}
          description={t('files.navigation.subtitle')}
          actions={
            <>
              <IconAction label={t('files.refresh')} tooltip disabled={loading} onPress={refresh}>
                <RefreshCw className="size-5" aria-hidden="true" />
              </IconAction>
              <Action
                variant="quiet"
                onPress={() => setPin({ targetKind: 'shared', targetId: '' })}
              >
                {t('files.navigation.pin')}
              </Action>
              <Action onPress={() => setSave({ address: '' })}>{t('files.navigation.save')}</Action>
            </>
          }
        />
        <form
          role="search"
          aria-label={t('files.navigation.search')}
          onSubmit={(event) => {
            event.preventDefault();
            filter({ search: searchText.trim() });
          }}
        >
          <Toolbar
            label={t('files.navigation.search')}
            primary={
              <>
                <div className="w-full min-w-0 sm:w-auto sm:min-w-48 sm:flex-1">
                  <SearchBox
                    label={t('files.navigation.search')}
                    placeholder={t('files.navigation.search')}
                    value={searchText}
                    onValueChange={(value) => setDraft({ source: query.search, value })}
                  />
                </div>
                <Action type="submit" variant="quiet" size="sm">
                  {t('files.navigation.search')}
                </Action>
                <SelectField
                  presentation="toolbar"
                  label={t('files.navigation.status')}
                  value={query.state}
                  onValueChange={(state) => filter({ state: state as SavedShareFilter })}
                  options={(['', 'active', 'protected', 'unavailable'] as const).map((value) => ({
                    value,
                    label: t(`files.navigation.${value || 'all'}`),
                  }))}
                />
              </>
            }
          />
        </form>
        {notice ? (
          <p role="status" className="text-sm">
            {notice}
          </p>
        ) : null}
        <section aria-busy={loading} aria-label={t('files.navigation.title')}>
          {loading ? (
            <StateSurface
              state="loading"
              icon={<Cloud />}
              title={t('files.loading')}
              description={t('files.loadingDescription')}
            />
          ) : failure ? (
            <StateSurface
              state="error"
              announcement="urgent"
              icon={<Cloud />}
              title={t('files.error')}
              description={failure}
              actionLabel={t('files.retry')}
              onAction={refresh}
            />
          ) : page?.items.length ? (
            <>
              <p role="status" className="text-sm text-ink-muted">
                {t('files.navigation.pageCount', { count: page.items.length })}
              </p>
              <ul className="divide-y divide-border">
                {page.items.map(({ entry, target: status }) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-4 py-4">
                    <FileGlyph kind="shortcut" mediaType={entry.mediaType} size="small" />
                    <div className="min-w-0 flex-1 basis-40">
                      <h2 className="break-words font-semibold">{entry.name}</h2>
                      <div className="mt-2">
                        <StatusPill
                          tone={
                            status.status !== 'active'
                              ? 'neutral'
                              : status.locked
                                ? 'warning'
                                : 'success'
                          }
                        >
                          {t(
                            `files.navigation.${status.status === 'active' ? (status.locked ? 'protected' : 'active') : status.status}`,
                          )}
                        </StatusPill>
                      </div>
                    </div>
                    {status.status === 'active' ? (
                      <a
                        className="inline-flex min-h-control items-center rounded-action px-3 text-sm font-medium text-brand outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus-ring"
                        href={nav.shortcutHref(entry.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('files.navigation.open')}
                      </a>
                    ) : null}
                    <MenuButton
                      label={<MoreHorizontal className="size-5" />}
                      ariaLabel={t('files.actionsFor', { name: entry.name })}
                      items={[
                        ...(['rename', 'move', 'copy', 'remove'] as const).map((id) => ({
                          id,
                          label: t(`files.${id}`),
                        })),
                        { id: 'pin', label: t('files.navigation.pin') },
                      ]}
                      onAction={(action) => {
                        if (action === 'pin')
                          setPin({ targetKind: 'shortcut', targetId: entry.id });
                        else if (
                          action === 'rename' ||
                          action === 'move' ||
                          action === 'copy' ||
                          action === 'remove'
                        )
                          setTarget({ entry, action });
                      }}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <StateSurface
              state="empty"
              icon={<Cloud />}
              title={t(
                query.cursor
                  ? 'files.navigation.emptyPage'
                  : hasFilters
                    ? 'files.navigation.noMatches'
                    : 'files.navigation.empty',
              )}
              description={t(
                query.cursor
                  ? 'files.navigation.emptyPageHint'
                  : hasFilters
                    ? 'files.navigation.noMatchesHint'
                    : 'files.navigation.emptyHint',
              )}
              actionLabel={t(
                query.cursor
                  ? 'files.navigation.firstPage'
                  : hasFilters
                    ? 'files.clearFileFilters'
                    : 'files.navigation.save',
              )}
              onAction={() => {
                if (query.cursor) filter({ cursor: '' });
                else if (hasFilters) filter({ search: '', state: '' });
                else setSave({ address: '' });
              }}
            />
          )}
        </section>
        {page ? (
          <p className="text-xs text-ink-muted">
            {t('files.navigation.limit', { count: page.shortcutLimit })}
          </p>
        ) : null}
        {page?.nextCursor || (query.cursor && (loading || failure || page?.items.length)) ? (
          <nav
            aria-label={t('files.navigation.pagination')}
            className="flex flex-wrap gap-3 border-t border-border pt-4"
          >
            {query.cursor ? (
              <Action variant="quiet" onPress={() => filter({ cursor: '' })}>
                {t('files.navigation.firstPage')}
              </Action>
            ) : null}
            <Action
              variant="quiet"
              disabled={!query.cursor || previous[href] === undefined || loading}
              onPress={() => filter({ cursor: previous[href] ?? '' })}
            >
              {t('files.navigation.previous')}
            </Action>
            <Action
              variant="quiet"
              disabled={!page?.nextCursor || loading}
              onPress={() => {
                if (!page?.nextCursor) return;
                const next = { ...query, cursor: page.nextCursor };
                setTrail({
                  nav,
                  cursors: {
                    ...previous,
                    [shortcutCatalogHref(files.destinationHref('shared'), next)]: query.cursor,
                  },
                });
                filter(next);
              }}
            >
              {t('files.navigation.next')}
            </Action>
          </nav>
        ) : null}
      </Page>

      {save ? (
        <SaveShortcutDialog
          address={save.address}
          onClose={closeSave}
          onSaved={() => {
            closeSave();
            filter({ cursor: '' });
            setNotice(t('files.navigation.saved'));
          }}
        />
      ) : null}
      {target ? (
        <ShortcutActionDialog
          entry={target.entry}
          action={target.action}
          onClose={() => setTarget(undefined)}
          onChanged={() => {
            setTarget(undefined);
            refresh();
          }}
        />
      ) : null}
      {pin ? (
        <PinDialog
          target={pin}
          onClose={() => setPin(undefined)}
          onChanged={() => {
            setPin(undefined);
            refresh();
          }}
        />
      ) : null}
    </>
  );
}
