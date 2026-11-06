'use client';
import { useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { SwitchField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { FilesError } from '../../../src/files/model';
import { parseHistoryDraft, type HistoryPreferences } from '../../../src/files/history-preferences';
import { useFiles } from '../../../src/files/runtime';

export function HistoryPreferencesDialog({ onClose }: { onClose: () => void }) {
  const port = useFiles(),
    { t } = useFrontendTranslation();
  const [draft, setDraft] = useState<HistoryPreferences>();
  const [extensions, setExtensions] = useState(''),
    [maximum, setMaximum] = useState('0');
  const [failure, setFailure] = useState(''),
    [readFailure, setReadFailure] = useState(''),
    [conflict, setConflict] = useState(false),
    [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void port
      .loadHistoryPreferences(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setDraft(value);
        setExtensions(value.extensions.join(', '));
        setMaximum(String(value.maxVersions));
        setFailure('');
        setReadFailure('');
        setConflict(false);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setReadFailure(
            t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [port, reload, t]);
  function readLatest() {
    setFailure('');
    setReadFailure('');
    setLoading(true);
    setReload((value) => value + 1);
  }
  return (
    <DialogSurface
      isOpen
      triggerLabel={t('files.retention.title')}
      title={t('files.retention.title')}
      description={t('files.retention.description')}
      cancelLabel={t('files.close')}
      confirmLabel={t('files.retention.save')}
      confirmDisabled={loading || !draft || conflict || !!readFailure}
      failureMessage={failure}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={async () => {
        if (!draft || !lifetime.current) throw new FilesError('canceled');
        const parsed = parseHistoryDraft(draft, extensions, maximum);
        if (!parsed.success) {
          setFailure(t('files.retention.invalid'));
          throw new FilesError('invalid');
        }
        setFailure('');
        try {
          await port.saveHistoryPreferences(parsed.data, lifetime.current.signal);
        } catch (error) {
          if (lifetime.current.signal.aborted) throw error;
          const changed = error instanceof FilesError && error.code === 'conflict';
          setConflict(changed);
          setFailure(
            t(
              changed
                ? 'files.retention.conflict'
                : 'files.errors.' + (error instanceof FilesError ? error.code : 'unavailable'),
            ),
          );
          throw error;
        }
      }}
    >
      <div className="min-w-0 space-y-4">
        {loading ? <p role="status">{t('files.retention.loading')}</p> : null}
        {draft && !readFailure ? (
          <>
            <SwitchField
              label={t('files.retention.enabled')}
              description={t('files.retention.enabledHint')}
              checked={draft.enabled}
              disabled={loading}
              onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
            />
            <TextField
              label={t('files.retention.extensions')}
              hint={t('files.retention.extensionsHint')}
              value={extensions}
              disabled={loading}
              onChange={(event) => setExtensions(event.target.value)}
            />
            <TextField
              label={t('files.retention.max')}
              hint={t('files.retention.maxHint')}
              value={maximum}
              disabled={loading}
              onChange={(event) => setMaximum(event.target.value)}
            />
            <p className="text-sm text-ink-muted">{t('files.retention.warning')}</p>
          </>
        ) : null}
        {readFailure ? (
          <p role="alert" className="text-sm text-danger">
            {readFailure}
          </p>
        ) : null}
        {!loading && (conflict || !draft || !!readFailure) ? (
          <Action variant="secondary" onPress={readLatest}>
            {t(conflict ? 'files.retention.latest' : 'files.retention.retry')}
          </Action>
        ) : null}
      </div>
    </DialogSurface>
  );
}
