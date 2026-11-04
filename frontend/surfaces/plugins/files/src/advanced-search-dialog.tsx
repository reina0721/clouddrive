'use client';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { CheckboxField, SelectField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DatePickerField } from '@clouddrive/ui-adapter/date-picker-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import {
  fileFiltersSchema,
  fileSearchLimits,
  fileSizeUnits,
  fileSizeInput,
  utcDateBoundary,
  utcInputDate,
  type FileFilters,
  type FileSizeUnit,
} from '../../../src/files/search';
import { FilesError } from '../../../src/files/model';
import { TagNamesInput } from './annotation-fields';

function SearchTags({
  field,
  value,
  onChange,
}: {
  field: 'keywords' | 'extensions';
  value: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const { t } = useFrontendTranslation(),
    [input, setInput] = useState(''),
    [failure, setFailure] = useState(false);
  const limit = field === 'keywords' ? fileSearchLimits.keywords : fileSearchLimits.extensions;
  return (
    <div className="space-y-2">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const result = fileFiltersSchema.safeParse({ [field]: [...value, input] });
          if (!result.success) {
            setFailure(true);
            return;
          }
          onChange(result.data[field] ?? []);
          setInput('');
          setFailure(false);
        }}
      >
        <TextField
          label={t(`files.discovery.${field}`)}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          autoComplete="off"
          hint={
            field === 'keywords'
              ? t('files.discovery.keywordHint', { count: limit })
              : t('files.discovery.extensionHint')
          }
        />
        <Action type="submit" variant="secondary" disabled={value.length >= limit || !input.trim()}>
          {t('files.discovery.add')}
        </Action>
      </form>
      {failure ? (
        <p role="alert" className="text-sm text-danger">
          {t('files.discovery.invalid')}
        </p>
      ) : null}
      <ul className="flex flex-wrap gap-2">
        {value.map((item, index) => (
          <li key={index} className="min-w-0 max-w-full">
            <Action
              size="sm"
              variant="secondary"
              onPress={() => onChange(value.filter((_, position) => position !== index))}
            >
              <span className="block max-w-44 truncate" title={item}>
                {t('files.discovery.remove', { value: item })}
              </span>
            </Action>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdvancedSearchDialog({
  filters,
  search,
  parent,
  onClose,
  onApply,
}: {
  filters: FileFilters;
  search: string;
  parent: string;
  onClose: () => void;
  onApply: (filter: FileFilters) => void;
}) {
  const { t } = useFrontendTranslation();
  const [keywords, setKeywords] = useState(filters.keywords ?? (search ? [search] : [])),
    [extensions, setExtensions] = useState(filters.extensions ?? []),
    [kinds, setKinds] = useState(filters.kinds ?? []);
  const [tagNames, setTagNames] = useState(filters.tagFilter?.names ?? []),
    [allTags, setAllTags] = useState(filters.tagFilter?.match !== 'any');
  const [propertyEnabled, setPropertyEnabled] = useState(!!filters.property),
    [propertyKey, setPropertyKey] = useState(filters.property?.key ?? ''),
    [propertyValue, setPropertyValue] = useState(filters.property?.value ?? ''),
    [propertyMatch, setPropertyMatch] = useState<NonNullable<FileFilters['property']>['match']>(
      filters.property?.match ?? 'exists',
    );
  const [scope, setScope] = useState<FileFilters['scope']>(
      filters.scope ?? (parent ? 'tree' : 'all'),
    ),
    [ignoreCase, setIgnoreCase] = useState(!filters.caseSensitive),
    [all, setAll] = useState(filters.match !== 'any');
  const [minSize, setMinSize] = useState(
      filters.minBytes === undefined ? '' : String(filters.minBytes),
    ),
    [maxSize, setMaxSize] = useState(
      filters.maxBytes === undefined ? '' : String(filters.maxBytes),
    ),
    [unit, setUnit] = useState<FileSizeUnit>('B');
  const [createdFrom, setCreatedFrom] = useState(utcInputDate(filters.createdFrom, 'from')),
    [createdThrough, setCreatedThrough] = useState(utcInputDate(filters.createdTo, 'through')),
    [modifiedFrom, setModifiedFrom] = useState(utcInputDate(filters.modifiedFrom, 'from')),
    [modifiedThrough, setModifiedThrough] = useState(utcInputDate(filters.modifiedTo, 'through')),
    [failure, setFailure] = useState('');
  return (
    <DialogSurface
      triggerLabel={t('files.discovery.advanced')}
      title={t('files.discovery.advanced')}
      description={t('files.discovery.advancedHint')}
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.discovery.apply')}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      failureMessage={failure}
      onConfirm={() => {
        try {
          const minBytes = fileSizeInput(minSize, unit),
            maxBytes = fileSizeInput(maxSize, unit),
            lowerCreated = utcDateBoundary(createdFrom, 'from'),
            upperCreated = utcDateBoundary(createdThrough, 'through'),
            lowerModified = utcDateBoundary(modifiedFrom, 'from'),
            upperModified = utcDateBoundary(modifiedThrough, 'through');
          const next = fileFiltersSchema.parse({
            scope,
            caseSensitive: !ignoreCase,
            match: all ? 'all' : 'any',
            ...(keywords.length ? { keywords } : {}),
            ...(extensions.length ? { extensions } : {}),
            ...(kinds.length ? { kinds } : {}),
            ...(minBytes === undefined ? {} : { minBytes }),
            ...(maxBytes === undefined ? {} : { maxBytes }),
            ...(lowerCreated ? { createdFrom: lowerCreated } : {}),
            ...(upperCreated ? { createdTo: upperCreated } : {}),
            ...(lowerModified ? { modifiedFrom: lowerModified } : {}),
            ...(upperModified ? { modifiedTo: upperModified } : {}),
            ...(tagNames.length
              ? { tagFilter: { names: tagNames, match: allTags ? 'all' : 'any' } }
              : {}),
            ...(propertyEnabled
              ? {
                  property: {
                    key: propertyKey,
                    match: propertyMatch,
                    ...(propertyMatch === 'exists' ? {} : { value: propertyValue }),
                  },
                }
              : {}),
          });
          onApply(next);
        } catch (error) {
          setFailure(
            t(
              error instanceof FilesError && error.code === 'large'
                ? 'files.discovery.tooLong'
                : 'files.discovery.invalid',
            ),
          );
          throw error;
        }
      }}
    >
      <div className="space-y-5">
        <SelectField
          label={t('files.discovery.scope')}
          value={scope ?? 'all'}
          onValueChange={(value) => setScope(value as FileFilters['scope'])}
          options={(['folder', 'tree', 'all'] as const).map((value) => ({
            value,
            label: t(
              `files.discovery.${value === 'folder' ? 'scopeFolder' : value === 'tree' ? 'scopeTree' : 'scopeAll'}`,
            ),
          }))}
        />
        <SearchTags field="keywords" value={keywords} onChange={setKeywords} />
        <div className="grid gap-3 sm:grid-cols-2">
          <CheckboxField
            label={t('files.discovery.ignoreCase')}
            checked={ignoreCase}
            onCheckedChange={setIgnoreCase}
          />
          <CheckboxField
            label={t('files.discovery.matchAll')}
            checked={all}
            onCheckedChange={setAll}
          />
        </div>
        <SearchTags field="extensions" value={extensions} onChange={setExtensions} />
        <section className="space-y-3" aria-label={t('files.annotations.tags')}>
          <TagNamesInput value={tagNames} onChange={setTagNames} />
          <CheckboxField
            label={t('files.annotations.tagAll')}
            checked={allTags}
            onCheckedChange={setAllTags}
          />
          <p className="text-xs text-ink-muted">{t('files.annotations.tagCaseHint')}</p>
        </section>
        <section className="space-y-3" aria-label={t('files.annotations.propertyFilter')}>
          <CheckboxField
            label={t('files.annotations.enableProperty')}
            checked={propertyEnabled}
            onCheckedChange={setPropertyEnabled}
          />
          {propertyEnabled ? (
            <>
              <TextField
                label={t('files.annotations.filterKey')}
                value={propertyKey}
                onChange={(event) => setPropertyKey(event.target.value)}
              />
              <SelectField
                label={t('files.annotations.propertyMatch')}
                value={propertyMatch}
                options={(['exists', 'equals', 'contains'] as const).map((value) => ({
                  value,
                  label: t('files.annotations.' + value),
                }))}
                onValueChange={(value) =>
                  setPropertyMatch(value as NonNullable<FileFilters['property']>['match'])
                }
              />
              {propertyMatch !== 'exists' ? (
                <TextField
                  label={t('files.annotations.filterValue')}
                  value={propertyValue}
                  onChange={(event) => setPropertyValue(event.target.value)}
                />
              ) : null}
            </>
          ) : null}
        </section>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold">{t('files.discovery.kinds')}</legend>
          {(['file', 'folder', 'shortcut'] as const).map((kind) => (
            <CheckboxField
              key={kind}
              label={t(`files.discovery.${kind}`)}
              checked={kinds.includes(kind)}
              onCheckedChange={(checked) =>
                setKinds((values) =>
                  checked ? [...values, kind] : values.filter((value) => value !== kind),
                )
              }
            />
          ))}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t('files.discovery.minSize')}
            value={minSize}
            onChange={(event) => setMinSize(event.target.value)}
          />
          <TextField
            label={t('files.discovery.maxSize')}
            value={maxSize}
            onChange={(event) => setMaxSize(event.target.value)}
          />
        </div>
        <SelectField
          label={t('files.discovery.unit')}
          value={unit}
          onValueChange={(value) => setUnit(value as FileSizeUnit)}
          options={Object.keys(fileSizeUnits).map((value) => ({ value, label: value }))}
        />
        <p className="text-xs text-ink-muted">{t('files.discovery.sizeHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { key: 'createdFrom', value: createdFrom, change: setCreatedFrom },
              { key: 'createdThrough', value: createdThrough, change: setCreatedThrough },
              { key: 'modifiedFrom', value: modifiedFrom, change: setModifiedFrom },
              { key: 'modifiedThrough', value: modifiedThrough, change: setModifiedThrough },
            ] as const
          ).map((field) => (
            <DatePickerField
              key={field.key}
              label={t(`files.discovery.${field.key}`)}
              calendarLabel={t('files.discovery.calendar')}
              value={field.value || null}
              onValueChange={(value) => field.change(value ?? '')}
            />
          ))}
        </div>
        <p className="text-xs text-ink-muted">{t('files.discovery.dateHint')}</p>
      </div>
    </DialogSurface>
  );
}
