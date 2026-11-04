'use client';
import type { ReactNode } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField } from '@clouddrive/ui-adapter/form-field';
import type { FileEntry } from '../../../src/files/model';
import type { FileViewPreferences, FileColumn } from '../../../src/files/view-options';
import { FileGlyph } from '../../../src/files/icons';
import { formatFileBytes } from './file-presentation';

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
  tabStop,
  thumbnail,
  actions,
  onChecked,
  onOpen,
  onSelect,
  onFocus,
  onContext,
}: {
  entry: FileEntry;
  view: FileViewPreferences['view'];
  columns: readonly FileColumn[];
  selected: boolean;
  tabStop: boolean;
  thumbnail: ReactNode;
  actions: ReactNode;
  onChecked: (checked: boolean) => void;
  onOpen: () => void;
  onSelect: (gesture: FileSelectionGesture) => void;
  onFocus: () => void;
  onContext: () => void;
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
      className="block max-w-full truncate text-left text-sm font-semibold outline-offset-4 hover:text-brand"
      onClick={(event) => {
        if (event.shiftKey || event.ctrlKey || event.metaKey)
          onSelect({ extend: event.shiftKey, toggle: event.ctrlKey || event.metaKey });
        else onOpen();
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
  const icon = thumbnail || (
    <FileGlyph kind={entry.kind} mediaType={entry.mediaType} size={isList ? 'small' : 'large'} />
  );
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
      className={`${isList ? 'flex min-w-0 items-center gap-3 border-b border-border py-3' : 'min-w-0 rounded-panel border border-border p-4'} ${selected ? 'bg-brand-soft' : 'hover:bg-surface-muted'}`}
    >
      {isList ? (
        <>
          <div role="cell" className="w-5 shrink-0">
            {selection}
          </div>
          <div role="cell" className="flex min-w-0 flex-1 items-center gap-3">
            <div className="size-7 shrink-0 overflow-hidden [&_img]:size-full [&_img]:object-cover">
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              {title}
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
          <div className="mb-3 flex items-center justify-between gap-3">
            {selection}
            {actions}
          </div>
          <div className="flex min-w-0 flex-col items-center gap-3 py-3">
            {icon}
            <div className="min-w-0 max-w-full">
              {title}
              <p className="mt-1 text-xs text-ink-muted">
                {entry.kind === 'file' ? formatFileBytes(entry.sizeBytes) : kind}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                {new Date(entry.trashedAt ?? entry.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
