'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { validateManagedProperty } from '../../../src/files/property-definitions';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { ConfirmDialog, DrawerSurface } from '@clouddrive/ui-adapter/overlays';
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
import { AnnotationSummary } from './annotation-summary';

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
  const formId = useId();
  const contentTarget = useRef<HTMLDivElement>(null);
  const errorTarget = useRef<HTMLDivElement>(null);
  const mode = useRef(false);
  const [editing, setEditing] = useState(false);
  const [discardIntent, setDiscardIntent] = useState<'close' | 'overview' | 'reload'>();
  const [detail, setDetail] = useState<FileAnnotationDetail>(),
    [draft, setDraft] = useState<FileAnnotationValues>(),
    [failure, setFailure] = useState<unknown>(),
    [notice, setNotice] = useState(''),
    [loading, setLoading] = useState(true),
    [pending, setPending] = useState(false);
  useEffect(() => {
    if (mode.current !== editing) contentTarget.current?.focus();
    mode.current = editing;
  }, [editing]);
  useEffect(() => {
    if (failure !== undefined) errorTarget.current?.focus();
  }, [failure]);
  const dirty = Boolean(
    detail && draft && JSON.stringify(draft) !== JSON.stringify(draftFrom(detail.annotation)),
  );
  function finish(intent: 'close' | 'overview' | 'reload') {
    if (intent === 'close') onClose();
    else if (intent === 'reload') onReload();
    else if (detail) {
      setDraft(draftFrom(detail.annotation));
      setEditing(false);
      setFailure(undefined);
      setNotice('');
    }
  }
  function request(intent: 'close' | 'overview' | 'reload') {
    if (pendingRef.current) return;
    if (dirty) setDiscardIntent(intent);
    else finish(intent);
  }
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
    if (!detail || !draft || !dirty || pendingRef.current) return;
    const current = generation.current;
    pendingRef.current = true;
    setPending(true);
    setFailure(undefined);
    setNotice('');
    try {
      const value = validateAnnotationValues(draft, detail.limits, detail.entry.kind);
      const changedInvalid = value.properties.some((property) => {
        const definition = detail.propertyDefinitions.find(
          (candidate) => candidate.key === property.key,
        );
        const unchanged = detail.annotation.properties.some(
          (current) => current.key === property.key && current.value === property.value,
        );
        return definition && !unchanged && !validateManagedProperty(definition, property.value);
      });
      if (changedInvalid) throw new FilesError('invalid');
      const saved = await port.replace(entry.id, {
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
      setEditing(false);
      onSaved();
    } catch (error) {
      if (generation.current === current) setFailure(error);
    } finally {
      pendingRef.current = false;
      if (generation.current === current) setPending(false);
    }
  }
  async function copy(value: string) {
    const current = generation.current;
    setNotice('');
    setFailure(undefined);
    try {
      await port.copyText(value);
      if (generation.current !== current) return;
      setNotice(t('files.annotations.copied'));
    } catch (error) {
      if (generation.current === current) setFailure(error);
    }
  }
  const path = detail
    ? '/' + [...detail.breadcrumbs.map((item) => item.name), detail.entry.name].join('/')
    : '';
  return (
    <>
      <DrawerSurface
        triggerLabel={t('files.annotations.title')}
        title={entry.name}
        description={t(editing ? 'files.annotations.editHint' : 'files.annotations.overviewHint')}
        closeLabel={t('files.close')}
        isOpen
        busy={pending}
        onOpenChange={(open) => {
          if (!open) request('close');
        }}
        footer={
          detail && draft ? (
            editing ? (
              <>
                <Action type="submit" form={formId} loading={pending} disabled={pending || !dirty}>
                  {t('files.annotations.save')}
                </Action>
                <Action variant="quiet" disabled={pending} onPress={() => request('overview')}>
                  {t('files.cancel')}
                </Action>
              </>
            ) : (
              <>
                <Action
                  onPress={() => {
                    setEditing(true);
                    setFailure(undefined);
                    setNotice('');
                  }}
                >
                  {t('files.annotations.edit')}
                </Action>
                {detail.entry.kind === 'file' ? (
                  <Action variant="quiet" onPress={onVersions}>
                    {t('files.versions.title')}
                  </Action>
                ) : null}
              </>
            )
          ) : undefined
        }
      >
        <div ref={contentTarget} tabIndex={-1} className="min-w-0 space-y-5 outline-none">
          {loading ? <p role="status">{t('files.annotations.loading')}</p> : null}
          {failure !== undefined ? (
            <div
              role="alert"
              tabIndex={-1}
              ref={errorTarget}
              className="space-y-3 rounded-control border border-danger p-3 text-sm text-danger"
            >
              <p>{errorText(failure)}</p>
              {detail && failure instanceof FilesError && failure.code === 'conflict' ? (
                <Action
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onPress={() => request('reload')}
                >
                  {t('files.annotations.reload')}
                </Action>
              ) : null}
            </div>
          ) : null}
          {notice ? (
            <p role="status" className="text-sm text-success">
              {notice}
            </p>
          ) : null}
          {detail && draft ? (
            editing ? (
              <form
                id={formId}
                className="min-w-0 space-y-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
              >
                <TagsEditor
                  value={draft.tags}
                  onChange={(tags) => setDraft({ ...draft, tags })}
                  defaultColor={detail.limits.defaultTagColor}
                  maxTags={detail.limits.maxTags}
                  disabled={pending}
                />
                <fieldset className="space-y-4 border-t border-border pt-5">
                  <legend className="font-semibold">{t('files.annotations.appearance')}</legend>
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
                        onChange={(event) =>
                          setDraft({ ...draft, folderColor: event.target.value })
                        }
                        hint={t('files.annotations.folderColorHint')}
                      />
                      <AnnotationColorDot color={draft.folderColor} />
                    </div>
                  ) : null}
                  <Action
                    size="sm"
                    variant="quiet"
                    disabled={pending || (!draft.emoji && !draft.folderColor)}
                    onPress={() => setDraft({ ...draft, emoji: '', folderColor: '' })}
                  >
                    {t('files.annotations.clearStyle')}
                  </Action>
                </fieldset>
                <PropertiesEditor
                  value={draft.properties}
                  onChange={(properties) => setDraft({ ...draft, properties })}
                  maxProperties={detail.limits.maxProperties}
                  definitions={detail.propertyDefinitions}
                  existing={detail.annotation.properties}
                  disabled={pending}
                />
                <p className="text-xs leading-5 text-ink-muted">
                  {t('files.annotations.budget', {
                    used: annotationEncodedBytes(draft),
                    max: detail.limits.maxBytes,
                    tags: detail.limits.maxTags,
                    properties: detail.limits.maxProperties,
                  })}
                </p>
              </form>
            ) : (
              <AnnotationSummary detail={detail} path={path} onCopy={(value) => void copy(value)} />
            )
          ) : !loading ? (
            <Action variant="secondary" onPress={onReload}>
              {t('files.retry')}
            </Action>
          ) : null}
        </div>
      </DrawerSurface>
      {discardIntent ? (
        <ConfirmDialog
          triggerLabel={t('files.annotations.discardTitle')}
          title={t('files.annotations.discardTitle')}
          description={t('files.annotations.discardHint')}
          impact={entry.name}
          cancelLabel={t('files.annotations.keepEditing')}
          confirmLabel={t('files.annotations.discard')}
          failureMessage={t('files.errors.unavailable')}
          isOpen
          onOpenChange={(open) => {
            if (!open) setDiscardIntent(undefined);
          }}
          onConfirm={() => finish(discardIntent)}
        />
      ) : null}
    </>
  );
}
