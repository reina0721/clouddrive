'use client';
import { lazy, Suspense, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { PasswordField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useFiles } from '../../../src/files/runtime';
import { FilesError, type FileEntry, type FileShare } from '../../../src/files/model';

import { SharePermissionFields, ShareExpiryFields } from './share-settings-fields';
import { initialShareExpiry, resolveShareExpiry } from './share-expiry';
import { useFileTime } from './use-file-time';
import {
  readOnlySharePermissions,
  initialShareAudience,
  shareAudienceValid,
  sharePermissionsValid,
  type SharePermissions,
} from '../../../src/files/sharing';
const ShareAudienceFields = lazy(() =>
  import('./audience-fields').then((module) => ({ default: module.ShareAudienceFields })),
);
export function ShareDialog({
  entry,
  onClose,
}: Readonly<{ entry: FileEntry; onClose: () => void }>) {
  const port = useFiles();
  const time = useFileTime();
  const { t } = useFrontendTranslation();
  const [audience, setAudience] = useState(initialShareAudience);
  const [password, setPassword] = useState('');
  const [expiry, setExpiry] = useState(() => initialShareExpiry(time.region.timeZone));
  const [title, setTitle] = useState('');
  const [permissions, setPermissions] = useState<SharePermissions>({ ...readOnlySharePermissions });
  const [created, setCreated] = useState<FileShare>();
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const errorText = (error: unknown) =>
    t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`);
  const failureNotice = failure ? (
    <p role="alert" className="text-sm text-danger">
      {failure}
    </p>
  ) : null;
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
            {t('files.shareExpires')}: {time.full(created.expiresAt)}
          </p>
          {failureNotice}
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
            const resolved = resolveShareExpiry(expiry);
            if (!resolved.ok) {
              setFailure(t('files.time.' + resolved.code));
              setBusy(false);
              return;
            }
            const expiresAt = resolved.value;
            void port
              .createShare({
                rootId: entry.id,
                audience,
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
          <Suspense fallback={<p role="status">{t('files.access.loading')}</p>}>
            <ShareAudienceFields
              value={audience}
              onChange={setAudience}
              rootKind={entry.kind === 'file' ? 'file' : 'folder'}
            />
          </Suspense>
          <ShareExpiryFields
            value={expiry}
            onChange={(value) => {
              setExpiry(value);
              setFailure('');
            }}
          />
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
          {failureNotice}
          <Action
            type="submit"
            loading={busy}
            disabled={!sharePermissionsValid(permissions) || !shareAudienceValid(audience)}
          >
            {t('files.createShare')}
          </Action>
        </form>
      )}
    </DialogSurface>
  );
}
