'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import type { FileAnnotationTag } from '../../../src/files/annotation-values';
import { AnnotationColorDot } from './annotation-fields';

export function TagBadges({
  tags,
  onTag,
}: {
  tags: readonly FileAnnotationTag[];
  onTag: (name: string) => void;
}) {
  const { t } = useFrontendTranslation();
  if (!tags.length) return null;
  return (
    <div className="mt-2 flex max-w-full flex-wrap gap-1">
      {tags.map((tag) => (
        <button
          type="button"
          key={tag.name}
          aria-label={t('files.annotations.tagSearch', { name: tag.name })}
          title={tag.name}
          onClick={() => onTag(tag.name)}
          className="inline-flex max-w-36 items-center gap-1 rounded-control border border-border bg-surface px-2 py-1 text-xs text-ink hover:bg-surface-muted"
        >
          <AnnotationColorDot color={tag.color} />
          <span className="truncate">{tag.name}</span>
        </button>
      ))}
    </div>
  );
}
