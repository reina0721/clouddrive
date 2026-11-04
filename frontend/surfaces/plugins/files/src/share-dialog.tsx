'use client';
import { useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { PasswordField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useFiles } from '../../../src/files/runtime';
import { FilesError, type FileEntry, type FileShare } from '../../../src/files/model';

import { SharePermissionFields, ShareExpiryFields } from './share-settings-fields';
import { initialShareExpiry, shareExpiryValue } from './share-expiry';
import {
  readOnlySharePermissions,
  sharePermissionsValid,
  type SharePermissions,
} from '../../../src/files/sharing';
export function ShareDialog({
  entry,
  onClose,
}: Readonly<{ entry: FileEntry; onClose: () => void }>) {
  const port = useFiles();
  const { t } = useFrontendTranslation();
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState(() => initialShareExpiry());
  const [title, setTitle] = useState('');
  const [permissions, setPermissions] = useState<SharePermissions>({ ...readOnlySharePermissions });
  const [created, setCreated] = useState<FileShare>();
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const errorText = (error: unknown) =>
    t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`);
  return (
    <DialogSurface
      triggerLabel={t('files.share')}
      title={t('files.share')}
      description={entry.name}
      cancelLabel={t('files.close')}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      {...(failure ? { failureMessage: failure } : {})}
    >
      {created ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">{t('files.shareCreated')}</p>
          <a
            href={port.shareLink(created.token)}
            target="_blank"
            rel="noreferrer"
            className="block break-all text-sm text-brand underline"
          >
            {port.shareLink(created.token)}
          </a>
          <p className="text-sm text-ink-muted">
            {t('files.shareExpires')}: {new Date(created.expiresAt).toLocaleString()}
          </p>
          <Action
            variant="secondary"
            onPress={() => {
              setFailure('');
              void port
                .copyShareLink(created.token)
                .then(() => setCopied(true))
                .catch((error: unknown) => setFailure(errorText(error)));
            }}
          >
            {t(copied ? 'files.linkCopied' : 'files.copyLink')}
          </Action>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setFailure('');
            const expiresAt = shareExpiryValue(expiry);
            if (expiresAt === '') {
              setFailure(t('files.errors.invalid'));
              setBusy(false);
              return;
            }
            void port
              .createShare({
                rootId: entry.id,
                password,
                title,
                permissions,
                ...(expiresAt ? { expiresAt } : {}),
              })
              .then((value) => {
                setCreated(value);
                setPassword('');
              })
              .catch((error: unknown) => setFailure(errorText(error)))
              .finally(() => setBusy(false));
          }}
        >
          <TextField
            label={t('files.collaboration.title')}
            hint={t('files.collaboration.titleHint')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <SharePermissionFields
            value={permissions}
            onChange={setPermissions}
            rootKind={entry.kind}
          />
          <ShareExpiryFields value={expiry} onChange={setExpiry} />
          <PasswordField
            label={t('files.sharePassword')}
            hint={t('files.sharePasswordHint')}
            purpose="new"
            showLabel={t('files.showPassword')}
            hideLabel={t('files.hidePassword')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className="text-sm text-ink-muted">{t('files.shareHint')}</p>
          <Action type="submit" loading={busy} disabled={!sharePermissionsValid(permissions)}>
            {t('files.createShare')}
          </Action>
        </form>
      )}
    </DialogSurface>
  );
}
