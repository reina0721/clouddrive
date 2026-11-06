'use client';
import { useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useFileTime } from './use-file-time';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { DrawerSurface } from '@clouddrive/ui-adapter/overlays';
import { FilesError, type FileEntry } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import {
  type FileAnnotationDetail,
  validateAnnotationValues,
} from '../../../src/files/annotations';
import {
  annotationEncodedBytes,
  type FileAnnotationValues,
  type FileAnnotationDocument,
} from '../../../src/files/annotation-values';
import { TagsEditor, PropertiesEditor, AnnotationColorDot } from './annotation-fields';

const draftFrom = (value: FileAnnotationDocument): FileAnnotationValues => ({
  tags: value.tags.map((tag) => ({ ...tag })),
  properties: value.properties.map((property) => ({ ...property })),
  emoji: value.emoji,
  folderColor: value.folderColor,
});

type AnnotationPanelProps = {
  entry: FileEntry;
  onClose: () => void;
  onSaved: () => void;
  onVersions: () => void;
};

export function AnnotationPanel(props: AnnotationPanelProps) {
  const [readRevision, setReadRevision] = useState(0);
  return (
    <AnnotationPanelContent
      key={props.entry.id + ':' + readRevision}
      {...props}
      onReload={() => setReadRevision((value) => value + 1)}
    />
  );
}

function AnnotationPanelContent({
  entry,
  onClose,
  onSaved,
  onReload,
  onVersions,
}: AnnotationPanelProps & { onReload: () => void }) {
  const port = useFiles().annotations,
    { t } = useFrontendTranslation();
  const time = useFileTime();
  const [detail, setDetail] = useState<FileAnnotationDetail>(),
    [draft, setDraft] = useState<FileAnnotationValues>(),
    [failure, setFailure] = useState<unknown>(),
    [notice, setNotice] = useState(''),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState(false);
  const generation = useRef(0),
    pendingRef = useRef(false);
  const errorText = (error: unknown) =>
    t(
      error instanceof FilesError && ['conflict', 'large', 'invalid'].includes(error.code)
        ? 'files.annotations.' + error.code
        : `files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`,
    );
  useEffect(() => {
    const current = ++generation.current,
      controller = new AbortController();
    void port
      .read(entry.id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted && generation.current === current) {
          setDetail(value);
          setDraft(draftFrom(value.annotation));
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && generation.current === current) setFailure(error);
      })
      .finally(() => {
        if (!controller.signal.aborted && generation.current === current) setLoading(false);
      });
    return () => {
      controller.abort();
      generation.current = current + 1;
    };
  }, [port, entry.id]);
  async function save() {
    if (!detail || !draft || pendingRef.current) return;
    const current = generation.current;
    pendingRef.current = true;
    setPending(true);
    setFailure(undefined);
    setNotice('');
    try {
      const value = validateAnnotationValues(draft, detail.limits, detail.entry.kind),
        saved = await port.replace(entry.id, {
          ...value,
          expectedRevision: detail.annotation.revision,
        });
      if (generation.current !== current) return;
      setDetail({
        ...detail,
        entry: { ...detail.entry, updatedAt: saved.updatedAt },
        annotation: saved,
      });
      setDraft(draftFrom(saved));
      setNotice(t('files.annotations.saved'));
      onSaved();
    } catch (error) {
      if (generation.current === current) setFailure(error);
    } finally {
      pendingRef.current = false;
      if (generation.current === current) setPending(false);
    }
  }
  async function copy(value: string) {
    try {
      await port.copyText(value);
      setNotice(t('files.annotations.copied'));
    } catch (error) {
      setFailure(error);
    }
  }
  const path = detail
    ? '/' + [...detail.breadcrumbs.map((item) => item.name), detail.entry.name].join('/')
    : '';
  return (
    <DrawerSurface
      triggerLabel={t('files.annotations.title')}
      title={entry.name}
      description={t('files.annotations.privateHint')}
      closeLabel={t('files.close')}
      isOpen
      onOpenChange={(open) => {
        if (!open && !pendingRef.current) onClose();
      }}
    >
      <div className="min-w-0 space-y-6">
        {loading ? <p role="status">{t('files.annotations.loading')}</p> : null}
        {failure !== undefined ? (
          <p role="alert" className="rounded-control border border-danger p-3 text-sm text-danger">
            {errorText(failure)}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="text-sm text-success">
            {notice}
          </p>
        ) : null}
        {detail && draft ? (
          <>
            <dl className="space-y-3 text-sm">
              {[
                [t('files.annotations.name'), detail.entry.name],
                [t('files.annotations.logicalPath'), path],
                [
                  t('files.type'),
                  detail.entry.kind === 'folder'
                    ? t('files.folder')
                    : detail.entry.kind === 'shortcut'
                      ? t('files.navigation.shortcut')
                      : detail.entry.mediaType,
                ],
                [
                  t('files.size'),
                  String(
                    detail.entry.kind === 'folder'
                      ? detail.statistics.logicalBytes
                      : detail.entry.sizeBytes,
                  ) + ' B',
                ],
                [t('files.created'), time.full(detail.entry.createdAt)],
                [t('files.updated'), time.full(detail.entry.updatedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="mt-1 break-words">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              <Action size="sm" variant="secondary" onPress={() => void copy(detail.entry.name)}>
                {t('files.annotations.copyName')}
              </Action>
              <Action size="sm" variant="secondary" onPress={() => void copy(path)}>
                {t('files.annotations.copyPath')}
              </Action>
              {detail.entry.kind === 'file' ? (
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={
                    pending ||
                    JSON.stringify(draft) !== JSON.stringify(draftFrom(detail.annotation))
                  }
                  onPress={onVersions}
                >
                  {t('files.versions.title')}
                </Action>
              ) : null}
            </div>
            {detail.entry.kind === 'folder' ? (
              <section
                aria-label={t('files.annotations.stats')}
                className="space-y-2 rounded-control border border-border p-3 text-sm"
              >
                <h3 className="font-semibold">{t('files.annotations.stats')}</h3>
                <dl className="grid grid-cols-2 gap-2">
                  {[
                    ['files', detail.statistics.files],
                    ['folders', detail.statistics.folders],
                    ['shortcuts', detail.statistics.shortcuts],
                    ['logicalBytes', String(detail.statistics.logicalBytes) + ' B'],
                  ].map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-ink-muted">{t('files.annotations.' + key)}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-xs text-ink-muted">{t('files.annotations.statsHint')}</p>
              </section>
            ) : null}
            <TagsEditor
              value={draft.tags}
              onChange={(tags) => setDraft({ ...draft, tags })}
              defaultColor={detail.limits.defaultTagColor}
              maxTags={detail.limits.maxTags}
              disabled={pending}
            />
            <PropertiesEditor
              value={draft.properties}
              onChange={(properties) => setDraft({ ...draft, properties })}
              maxProperties={detail.limits.maxProperties}
              disabled={pending}
            />
            <TextField
              label={t('files.annotations.emoji')}
              value={draft.emoji}
              disabled={pending}
              onChange={(event) => setDraft({ ...draft, emoji: event.target.value })}
              hint={t('files.annotations.emojiHint', { count: detail.limits.maxEmojiRunes })}
            />
            {detail.entry.kind === 'folder' ? (
              <div className="flex items-end gap-3">
                <TextField
                  label={t('files.annotations.folderColor')}
                  value={draft.folderColor}
                  disabled={pending}
                  onChange={(event) => setDraft({ ...draft, folderColor: event.target.value })}
                  hint={t('files.annotations.folderColorHint')}
                />
                <AnnotationColorDot color={draft.folderColor} />
              </div>
            ) : null}
            <Action
              size="sm"
              variant="secondary"
              disabled={pending}
              onPress={() => setDraft({ ...draft, emoji: '', folderColor: '' })}
            >
              {t('files.annotations.clearStyle')}
            </Action>
            <p className="text-xs text-ink-muted">
              {t('files.annotations.budget', {
                used: annotationEncodedBytes(draft),
                max: detail.limits.maxBytes,
                tags: detail.limits.maxTags,
                properties: detail.limits.maxProperties,
              })}
            </p>
            <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-surface py-4">
              <Action loading={pending} disabled={pending} onPress={() => void save()}>
                {t('files.annotations.save')}
              </Action>
              <Action variant="quiet" disabled={pending} onPress={onReload}>
                {t('files.annotations.reload')}
              </Action>
            </div>
          </>
        ) : !loading ? (
          <Action variant="secondary" onPress={onReload}>
            {t('files.retry')}
          </Action>
        ) : null}
      </div>
    </DrawerSurface>
  );
}
