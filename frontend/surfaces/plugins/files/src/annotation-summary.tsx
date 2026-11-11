'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { formatFileBytes } from '../../../src/files/format';
import type { FileAnnotationDetail } from '../../../src/files/annotations';
import { AnnotationColorDot } from './annotation-fields';
import { useFileTime } from './use-file-time';

export function AnnotationSummary({
  detail,
  path,
  onCopy,
}: {
  detail: FileAnnotationDetail;
  path: string;
  onCopy: (value: string) => void;
}) {
  const { t } = useFrontendTranslation();
  const time = useFileTime();
  const { entry, annotation, statistics } = detail;
  return (
    <div className="min-w-0 space-y-6">
      <DescriptionList
        label={t('files.annotations.identity')}
        items={[
          { id: 'name', term: t('files.annotations.name'), description: entry.name },
          { id: 'path', term: t('files.annotations.logicalPath'), description: path },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Action size="sm" variant="quiet" onPress={() => onCopy(entry.name)}>
          {t('files.annotations.copyName')}
        </Action>
        <Action size="sm" variant="quiet" onPress={() => onCopy(path)}>
          {t('files.annotations.copyPath')}
        </Action>
      </div>
      <DescriptionList
        label={t('files.annotations.facts')}
        columns={2}
        items={[
          {
            id: 'type',
            term: t('files.type'),
            description:
              entry.kind === 'folder'
                ? t('files.folder')
                : entry.kind === 'shortcut'
                  ? t('files.navigation.shortcut')
                  : entry.mediaType || t('files.file'),
          },
          ...(entry.kind === 'file'
            ? [{ id: 'size', term: t('files.size'), description: formatFileBytes(entry.sizeBytes) }]
            : []),
          {
            id: 'created',
            term: t('files.created'),
            description: <time dateTime={entry.createdAt}>{time.full(entry.createdAt)}</time>,
          },
          {
            id: 'updated',
            term: t('files.updated'),
            description: <time dateTime={entry.updatedAt}>{time.full(entry.updatedAt)}</time>,
          },
        ]}
      />
      {entry.kind === 'folder' ? (
        <section
          aria-label={t('files.annotations.stats')}
          className="space-y-3 border-t border-border pt-5"
        >
          <h3 className="font-semibold">{t('files.annotations.stats')}</h3>
          <DescriptionList
            label={t('files.annotations.stats')}
            columns={2}
            items={[
              ['files', statistics.files],
              ['folders', statistics.folders],
              ['shortcuts', statistics.shortcuts],
              ['logicalBytes', formatFileBytes(statistics.logicalBytes)],
            ].map(([key, value]) => ({
              id: String(key),
              term: t('files.annotations.' + key),
              description: value,
            }))}
          />
          <p className="text-xs leading-5 text-ink-muted">{t('files.annotations.statsHint')}</p>
        </section>
      ) : null}
      <section
        aria-label={t('files.annotations.organization')}
        className="space-y-4 border-t border-border pt-5"
      >
        <div>
          <h3 className="font-semibold">{t('files.annotations.organization')}</h3>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            {t('files.annotations.privateHint')}
          </p>
        </div>
        {annotation.tags.length ? (
          <ul aria-label={t('files.annotations.tags')} className="flex flex-wrap gap-2">
            {annotation.tags.map((tag) => (
              <li
                key={tag.name}
                className="flex min-w-0 max-w-full items-center gap-2 rounded-control bg-surface-muted px-3 py-1 text-sm"
              >
                <AnnotationColorDot color={tag.color} />
                <span className="break-words">{tag.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">{t('files.annotations.noTags')}</p>
        )}
        {annotation.properties.length ? (
          <DescriptionList
            label={t('files.annotations.properties')}
            items={annotation.properties.map((property) => ({
              id: property.key,
              term:
                detail.propertyDefinitions.find((item) => item.key === property.key)?.name ??
                property.key,
              description: (
                <span className="whitespace-pre-wrap">
                  {property.value || t('files.annotations.emptyValue')}
                </span>
              ),
            }))}
          />
        ) : null}
        {annotation.emoji || annotation.folderColor ? (
          <DescriptionList
            label={t('files.annotations.appearance')}
            columns={2}
            items={[
              ...(annotation.emoji
                ? [
                    {
                      id: 'emoji',
                      term: t('files.annotations.emoji'),
                      description: annotation.emoji,
                    },
                  ]
                : []),
              ...(annotation.folderColor
                ? [
                    {
                      id: 'color',
                      term: t('files.annotations.folderColor'),
                      description: (
                        <span className="inline-flex items-center gap-2">
                          <AnnotationColorDot color={annotation.folderColor} />
                          {annotation.folderColor}
                        </span>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        ) : null}
      </section>
    </div>
  );
}
