'use client';
import type { ReactNode } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField } from '@clouddrive/ui-adapter/form-field';
import type { FileEntry } from '../../../src/files/model';
import type { FileViewPreferences, FileColumn } from '../../../src/files/view-options';
import { FileGlyph } from '../../../src/files/icons';
import { formatFileBytes } from '../../../src/files/format';
import type { FileAnnotationSummary } from '../../../src/files/annotation-values';
import { TagBadges } from './tag-badges';

export type FileSelectionGesture = Readonly<{ extend: boolean; toggle: boolean }>;
export function FileListHeader({
  preferences,
  onSort,
}: {
  preferences: FileViewPreferences;
  onSort: (key: FileViewPreferences['sort']) => void;
}) {
  const { t } = useFrontendTranslation();
  const header = (key: FileViewPreferences['sort'], label: string) => (
    <div
      role="columnheader"
      aria-sort={
        preferences.sort === key ? (preferences.desc ? 'descending' : 'ascending') : 'none'
      }
    >
      <Action size="sm" variant="quiet" onPress={() => onSort(key)}>
        {label}
        {preferences.sort === key ? (preferences.desc ? ' ↓' : ' ↑') : ''}
      </Action>
    </div>
  );
  return (
    <div
      role="row"
      className="flex min-w-0 items-center gap-3 border-b border-border py-2 text-xs text-ink-muted"
    >
      <div role="columnheader" className="w-5 shrink-0">
        <span className="sr-only">{t('files.discovery.selectPage')}</span>
      </div>
      <div className="min-w-0 flex-1">{header('name', t('files.name'))}</div>
      {preferences.columns.map((column) => (
        <div key={column} className="hidden w-20 shrink-0 sm:block">
          {column === 'kind' ? (
            <div role="columnheader">{t('files.discovery.kind')}</div>
          ) : (
            header(column, t(`files.discovery.${column}`))
          )}
        </div>
      ))}
      <div role="columnheader" className="w-8 shrink-0">
        <span className="sr-only">{t('files.discovery.actions')}</span>
      </div>
    </div>
  );
}

export function FileItem({
  entry,
  view,
  columns,
  selected,
  cut,
  tabStop,
  thumbnail,
  actions,
  onChecked,
  onOpen,
  onSelect,
  onFocus,
  onContext,
  annotation,
  onTag,
  folderClick = 'open',
}: {
  entry: FileEntry;
  view: FileViewPreferences['view'];
  columns: readonly FileColumn[];
  selected: boolean;
  cut: boolean;
  tabStop: boolean;
  thumbnail: ReactNode;
  actions: ReactNode;
  onChecked: (checked: boolean) => void;
  onOpen: () => void;
  onSelect: (gesture: FileSelectionGesture) => void;
  onFocus: () => void;
  onContext: () => void;
  annotation?: FileAnnotationSummary | undefined;
  onTag: (name: string) => void;
  folderClick?: 'open' | 'select' | undefined;
}) {
  const { t } = useFrontendTranslation(),
    isList = view === 'list';
  const kind = t(
    entry.kind === 'file'
      ? 'files.discovery.file'
      : entry.kind === 'folder'
        ? 'files.folder'
        : 'files.navigation.shortcut',
  );
  const title = (
    <button
      type="button"
      id={'file-entry-' + entry.id}
      data-file-entry={entry.id}
      tabIndex={tabStop ? 0 : -1}
      onFocus={onFocus}
      title={entry.name}
      className={`${isList ? 'block truncate' : 'line-clamp-2 break-all'} max-w-full text-left text-sm font-medium outline-offset-4 hover:text-brand`}
      onClick={(event) => {
        if (event.shiftKey || event.ctrlKey || event.metaKey)
          onSelect({ extend: event.shiftKey, toggle: event.ctrlKey || event.metaKey });
        else if (entry.kind === 'folder' && folderClick === 'select' && event.detail !== 0)
          onSelect({ extend: false, toggle: false });
        else onOpen();
      }}
      onDoubleClick={() => {
        if (entry.kind === 'folder' && folderClick === 'select') onOpen();
      }}
    >
      {entry.name}
    </button>
  );
  const selection = (
    <CheckboxField
      label={t('files.selectFile', { name: entry.name })}
      presentation="control-only"
      checked={selected}
      onCheckedChange={onChecked}
    />
  );
  const glyph = (
    <FileGlyph
      kind={entry.kind}
      mediaType={entry.mediaType}
      size={isList ? 'small' : 'large'}
      emoji={annotation?.emoji}
      color={annotation?.folderColor}
    />
  );
  const icon = annotation?.emoji ? glyph : thumbnail || glyph;
  const tags = annotation ? <TagBadges tags={annotation.tags} onTag={onTag} /> : null;
  const columnValue = (column: FileColumn) =>
    column === 'kind'
      ? kind
      : column === 'size'
        ? entry.kind === 'file'
          ? formatFileBytes(entry.sizeBytes)
          : '—'
        : new Date(column === 'created' ? entry.createdAt : entry.updatedAt).toLocaleDateString(
            undefined,
            { timeZone: 'UTC' },
          );
  return (
    <article
      role={isList ? 'row' : undefined}
      data-file-item={entry.id}
      onContextMenu={(event) => {
        event.preventDefault();
        onContext();
      }}
      data-file-cut={cut || undefined}
      className={`${isList ? 'flex min-w-0 items-center gap-2 border-b border-border py-2' : 'min-w-0 rounded-control border border-border p-2'} ${selected ? 'bg-brand-soft' : 'hover:bg-surface-muted'} ${cut ? 'opacity-50' : ''}`}
    >
      {isList ? (
        <>
          <div role="cell" className="w-5 shrink-0">
            {selection}
            {cut ? <span className="sr-only">{t('files.explorer.cutMark')}</span> : null}
          </div>
          <div role="cell" className="flex min-w-0 flex-1 items-center gap-3">
            <div className="size-7 shrink-0 overflow-hidden [&_img]:size-full [&_img]:object-cover">
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              {title}
              {tags}
              <p className="mt-1 text-xs text-ink-muted sm:hidden">
                {entry.kind === 'file' ? formatFileBytes(entry.sizeBytes) : kind}
              </p>
            </div>
          </div>
          {columns.map((column) => (
            <div
              role="cell"
              key={column}
              className="hidden w-20 shrink-0 truncate text-xs text-ink-muted sm:block"
              title={columnValue(column)}
            >
              {columnValue(column)}
            </div>
          ))}
          <div role="cell" className="w-8 shrink-0">
            {actions}
          </div>
        </>
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between gap-2">
            {selection}
            {cut ? (
              <span className="text-xs text-ink-muted">{t('files.explorer.cutMark')}</span>
            ) : null}
            {actions}
          </div>
          <div className="flex min-w-0 flex-col items-center gap-2 py-1">
            {icon}
            <div className="min-w-0 max-w-full w-full">
              {title}
              {tags}
              <p className="mt-1 text-xs text-ink-muted">
                {entry.kind === 'file' ? formatFileBytes(entry.sizeBytes) : kind}
              </p>
              <p
                className="mt-1 truncate text-xs text-ink-muted"
                title={new Date(entry.trashedAt ?? entry.updatedAt).toLocaleString()}
              >
                {new Date(entry.trashedAt ?? entry.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
