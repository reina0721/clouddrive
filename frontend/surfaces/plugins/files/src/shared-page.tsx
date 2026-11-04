'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Page, Toolbar } from '@clouddrive/surface-foundation/layout';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField } from '@clouddrive/ui-adapter/form-field';
import { MenuButton } from '@clouddrive/ui-adapter/menu-button';
import { SearchBox } from '@clouddrive/ui-adapter/search-box';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { useEffect, useState } from 'react';
import { Cloud, FileGlyph, MoreHorizontal } from '../../../src/files/icons';
import { FilesError, type FileEntry } from '../../../src/files/model';
import type { PinTarget, SavedShareFilter, ShortcutListing } from '../../../src/files/navigation';
import { useFileNavigation } from '../../../src/files/runtime';
import { useWorkspaceRevision } from '../stores/workspace';
import { PinDialog } from './pinned-links';
import { SaveShortcutDialog, ShortcutActionDialog, type ShortcutAction } from './shortcut-dialogs';

export function SharedPage() {
  const nav = useFileNavigation(),
    { t } = useFrontendTranslation();
  const [page, setPage] = useState<ShortcutListing>(),
    [loading, setLoading] = useState(true),
    [failure, setFailure] = useState(''),
    [notice, setNotice] = useState('');
  const [revision, setRevision] = useWorkspaceRevision();
  const [searchText, setSearchText] = useState(''),
    [search, setSearch] = useState(''),
    [state, setState] = useState<SavedShareFilter>(''),
    [cursor, setCursor] = useState(''),
    [previous, setPrevious] = useState<string[]>([]);
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
    void nav
      .shortcuts({ search, state, cursor }, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setPage(value);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [nav, search, state, cursor, revision, t]);
  const refresh = () => {
    setLoading(true);
    setFailure('');
    setPage(undefined);
    setRevision((value) => value + 1);
  };
  const closeSave = () => {
    nav.clearSaveIntent();
    setSave(undefined);
  };
  function reset() {
    refresh();
    setCursor('');
    setPrevious([]);
  }
  return (
    <>
      <Page>
        <Toolbar
          label={t('files.navigation.title')}
          primary={<h1 className="text-2xl font-semibold">{t('files.navigation.title')}</h1>}
          secondary={
            <div className="flex flex-wrap gap-2">
              <Action variant="secondary" onPress={refresh}>
                {t('files.refresh')}
              </Action>
              <Action
                variant="secondary"
                onPress={() => setPin({ targetKind: 'shared', targetId: '' })}
              >
                {t('files.navigation.pin')}
              </Action>
              <Action onPress={() => setSave({ address: '' })}>{t('files.navigation.save')}</Action>
            </div>
          }
        />
        <p className="text-sm text-ink-muted">{t('files.navigation.subtitle')}</p>
        <div className="flex flex-wrap items-end gap-4">
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              reset();
              setSearch(searchText);
            }}
          >
            <SearchBox
              label={t('files.navigation.search')}
              placeholder={t('files.navigation.search')}
              value={searchText}
              onValueChange={setSearchText}
            />
            <Action type="submit" variant="secondary">
              {t('files.navigation.search')}
            </Action>
          </form>
          <SelectField
            label={t('files.navigation.status')}
            value={state}
            onValueChange={(value) => {
              reset();
              setState(value as SavedShareFilter);
            }}
            options={(['', 'active', 'protected', 'unavailable'] as const).map((value) => ({
              value,
              label: t(`files.navigation.${value || 'all'}`),
            }))}
          />
        </div>
        {notice ? (
          <p role="status" className="text-sm">
            {notice}
          </p>
        ) : null}
        <section
          aria-busy={loading}
          className="min-h-96 rounded-panel border border-border bg-surface p-4"
        >
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
              icon={<Cloud />}
              title={t('files.error')}
              description={failure}
              actionLabel={t('files.retry')}
              onAction={refresh}
            />
          ) : page?.items.length ? (
            <ul className="divide-y divide-border">
              {page.items.map(({ entry, target: status }) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-4 py-4">
                  <FileGlyph kind="shortcut" mediaType={entry.mediaType} size="small" />
                  <div className="min-w-0 flex-1 basis-40">
                    <h2 className="break-words font-semibold">{entry.name}</h2>
                    <p className="mt-1 text-sm text-ink-muted">
                      {t(
                        `files.navigation.${status.status === 'active' ? (status.locked ? 'protected' : 'active') : status.status}`,
                      )}
                    </p>
                  </div>
                  {status.status === 'active' ? (
                    <a
                      className="rounded-control border border-border px-3 py-2 text-sm"
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
                      if (action === 'pin') setPin({ targetKind: 'shortcut', targetId: entry.id });
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
          ) : (
            <StateSurface
              state="empty"
              icon={<Cloud />}
              title={t('files.navigation.empty')}
              description={t('files.navigation.emptyHint')}
              actionLabel={t('files.navigation.save')}
              onAction={() => setSave({ address: '' })}
            />
          )}
        </section>
        {page ? (
          <>
            <p className="text-xs text-ink-muted">
              {t('files.navigation.limit', { count: page.shortcutLimit })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Action
                variant="secondary"
                disabled={!previous.length || loading}
                onPress={() => {
                  setLoading(true);
                  setFailure('');
                  setCursor(previous.at(-1) ?? '');
                  setPrevious((values) => values.slice(0, -1));
                }}
              >
                {t('files.navigation.previous')}
              </Action>
              <Action
                variant="secondary"
                disabled={!page.nextCursor || loading}
                onPress={() => {
                  setLoading(true);
                  setFailure('');
                  setPrevious((values) => [...values, cursor]);
                  setCursor(page.nextCursor);
                }}
              >
                {t('files.navigation.next')}
              </Action>
            </div>
          </>
        ) : null}
      </Page>

      {save ? (
        <SaveShortcutDialog
          address={save.address}
          onClose={closeSave}
          onSaved={() => {
            closeSave();
            setNotice(t('files.navigation.saved'));
            reset();
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
