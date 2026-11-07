'use client';
import { useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { FilesError } from '../../../src/files/model';
import { useFiles } from '../../../src/files/runtime';
import {
  maxTrashRetentionDays,
  trashRetentionSchema,
  type TrashRetention,
} from '../../../src/files/trash-retention';

export default function TrashRetentionDialog({ onClose }: { onClose: () => void }) {
  const port = useFiles();
  const { t } = useFrontendTranslation();
  const request = useRef<AbortController>(null);
  const [policy, setPolicy] = useState<TrashRetention>();
  const [days, setDays] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [failure, setFailure] = useState('');
  const [retry, setRetry] = useState<'read' | 'conflict'>();
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    void port.loadTrashRetention(controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        setPolicy(result);
        setDays(String(result.days));
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setRetry('read');
        setFailure(t('files.errors.' + (error instanceof FilesError ? error.code : 'unavailable')));
      },
    );
    return () => controller.abort();
  }, [port, refresh, t]);

  return (
    <DialogSurface
      isOpen
      triggerLabel={t('files.trashRetention.title')}
      title={t('files.trashRetention.title')}
      description={t('files.trashRetention.description')}
      cancelLabel={t('files.close')}
      confirmLabel={t('files.save')}
      confirmDisabled={!policy || !!retry}
      failureMessage={failure}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onConfirm={async () => {
        const signal = request.current?.signal;
        if (!policy || !signal) throw new FilesError('canceled');
        const parsed = trashRetentionSchema.safeParse({
          days: /^\d+$/.test(days) ? Number(days) : Number.NaN,
          revision: policy.revision,
        });
        if (!parsed.success) {
          setFailure(t('files.trashRetention.invalid'));
          throw new FilesError('invalid');
        }
        setFailure('');
        try {
          await port.saveTrashRetention(parsed.data, signal);
        } catch (error) {
          if (!signal.aborted) {
            const conflict = error instanceof FilesError && error.code === 'conflict';
            if (conflict) setRetry('conflict');
            setFailure(
              t(
                conflict
                  ? 'files.retention.conflict'
                  : 'files.errors.' + (error instanceof FilesError ? error.code : 'unavailable'),
              ),
            );
          }
          throw error;
        }
      }}
    >
      <div className="min-w-0 space-y-4">
        {!policy && !retry ? <p role="status">{t('files.trashRetention.loading')}</p> : null}
        {policy ? (
          <TextField
            label={t('files.trashRetention.days')}
            hint={t('files.trashRetention.hint', { max: maxTrashRetentionDays })}
            inputMode="numeric"
            value={days}
            disabled={!!retry}
            onChange={(event) => setDays(event.target.value)}
          />
        ) : null}
        {retry ? (
          <Action
            variant="secondary"
            onPress={() => {
              setRetry(undefined);
              setPolicy(undefined);
              setFailure('');
              setRefresh((value) => value + 1);
            }}
          >
            {t(retry === 'conflict' ? 'files.retention.latest' : 'files.retention.retry')}
          </Action>
        ) : null}
      </div>
    </DialogSurface>
  );
}
