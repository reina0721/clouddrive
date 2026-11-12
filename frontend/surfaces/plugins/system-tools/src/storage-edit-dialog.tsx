'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { ConfirmDialog, DialogSurface } from '@clouddrive/ui-adapter/overlays';

/** 存储设置的编辑会话：关闭与读取最新配置分别确认，提交期间保持会话。 */
export function StorageEditDialog({
  title,
  saveLabel,
  formId,
  dirty,
  busy,
  disabled,
  error,
  conflict,
  onClose,
  onReload,
  children,
}: Readonly<{
  title: string;
  saveLabel: string;
  formId: string;
  dirty: boolean;
  busy: boolean;
  disabled: boolean;
  error?: string;
  conflict: boolean;
  onClose: () => void;
  onReload: () => Promise<void>;
  children: ReactNode;
}>) {
  const { t } = useFrontendTranslation();
  const label = (key: string) => t('systemTools.storage.' + key);
  const [intent, setIntent] = useState<'close' | 'reload'>();
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  function request(next: 'close' | 'reload') {
    if (busy) return;
    if (dirty) setIntent(next);
    else if (next === 'close') onClose();
    else void onReload();
  }
  return (
    <>
      <DialogSurface
        isOpen
        title={title}
        triggerLabel={title}
        description={label('changesTiming')}
        cancelLabel={t('files.cancel')}
        busy={busy}
        onOpenChange={(open) => {
          if (!open) request('close');
        }}
        footerAction={
          <Action type="submit" form={formId} disabled={disabled} loading={busy}>
            {saveLabel}
          </Action>
        }
      >
        {error ? (
          <div className="mb-4 space-y-3">
            <p role="alert" tabIndex={-1} ref={errorRef} className="text-sm text-danger">
              {error}
            </p>
            {conflict ? (
              <Action variant="secondary" onPress={() => request('reload')} disabled={busy}>
                {label('reloadLatest')}
              </Action>
            ) : null}
          </div>
        ) : null}
        {children}
      </DialogSurface>
      {intent ? (
        <ConfirmDialog
          isOpen
          title={label('discardTitle')}
          triggerLabel={label('discardTitle')}
          description={label(intent === 'close' ? 'discardClose' : 'discardReload')}
          cancelLabel={label('keepEditing')}
          confirmLabel={label('discardChanges')}
          impact={title}
          failureMessage={label('reloadFailed')}
          onOpenChange={(open) => {
            if (!open) setIntent(undefined);
          }}
          onConfirm={async () => {
            if (intent === 'close') onClose();
            else await onReload();
            setIntent(undefined);
          }}
        />
      ) : null}
    </>
  );
}
