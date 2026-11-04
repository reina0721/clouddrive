'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { fileFilterKeys, utcInputDate, type FileFilters } from '../../../src/files/search';

const chipLabels: Partial<Record<keyof FileFilters, string>> = {
  minBytes: 'minSize',
  maxBytes: 'maxSize',
  createdTo: 'createdThrough',
  modifiedTo: 'modifiedThrough',
};

export function ActiveFilterChips({
  filters,
  onChange,
}: {
  filters: FileFilters;
  onChange: (value: FileFilters) => void;
}) {
  const { t } = useFrontendTranslation();
  if (!fileFilterKeys.some((key) => filters[key] !== undefined)) return null;
  return (
    <section
      aria-label={t('files.discovery.conditions')}
      className="flex flex-wrap items-center gap-2"
    >
      {fileFilterKeys.flatMap((key) => {
        const field = filters[key];
        if (field === undefined) return [];
        const values = Array.isArray(field) ? field : [field];
        return values.map((value, index) => {
          const display =
            key === 'minBytes' || key === 'maxBytes'
              ? String(value) + ' B'
              : key === 'createdFrom' || key === 'modifiedFrom'
                ? utcInputDate(String(value), 'from')
                : key === 'createdTo' || key === 'modifiedTo'
                  ? utcInputDate(String(value), 'through')
                  : String(value);
          const label =
            key === 'caseSensitive'
              ? t(value ? 'files.discovery.caseSensitive' : 'files.discovery.ignoreCase')
              : key === 'match'
                ? t(value === 'any' ? 'files.discovery.anyKeyword' : 'files.discovery.matchAll')
                : key === 'scope'
                  ? t(
                      `files.discovery.${value === 'folder' ? 'scopeFolder' : value === 'tree' ? 'scopeTree' : 'scopeAll'}`,
                    )
                  : key === 'kinds'
                    ? t(`files.discovery.${String(value)}`)
                    : `${t('files.discovery.' + (chipLabels[key] ?? key))}: ${display}`;
          return (
            <Action
              key={key + '-' + index}
              size="sm"
              variant="secondary"
              onPress={() => {
                const next = { ...filters };
                if (Array.isArray(field) && field.length > 1)
                  Object.assign(next, { [key]: field.filter((_, position) => position !== index) });
                else delete next[key];
                onChange(next);
              }}
            >
              <span className="block max-w-44 truncate" title={label}>
                {t('files.discovery.remove', { value: label })}
              </span>
            </Action>
          );
        });
      })}
      <Action size="sm" variant="quiet" onPress={() => onChange({})}>
        {t('files.discovery.clear')}
      </Action>
    </section>
  );
}
