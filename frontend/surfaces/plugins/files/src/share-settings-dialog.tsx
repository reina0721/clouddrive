'use client';
import { lazy, Suspense, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useFileTime } from './use-file-time';
import { Action } from '@clouddrive/ui-adapter/action';
import { TextField, PasswordField, SelectField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface, DrawerSurface } from '@clouddrive/ui-adapter/overlays';
import { useFiles } from '../../../src/files/runtime';
import { FilesError, type FileShare } from '../../../src/files/model';
import {
  sharePermissionsValid,
  shareAudienceValid,
  type SharePermissions,
} from '../../../src/files/sharing';
import { ShareExpiryFields, SharePermissionFields } from './share-settings-fields';
import { initialShareExpiry, resolveShareExpiry } from './share-expiry';

const ShareAudienceFields = lazy(() =>
  import('./audience-fields').then((module) => ({ default: module.ShareAudienceFields })),
);
export function ShareSettingsDialog({
  share,
  onClose,
  onSaved,
}: Readonly<{ share: FileShare; onClose(): void; onSaved(): void }>) {
  const port = useFiles(),
    { t } = useFrontendTranslation();
  const time = useFileTime();
  const [audience, setAudience] = useState(share.audience);
  const [current, setCurrent] = useState(share),
    [title, setTitle] = useState(share.title),
    [permissions, setPermissions] = useState<SharePermissions>(share.permissions),
    [expiry, setExpiry] = useState(() => initialShareExpiry(time.region.timeZone, share.expiresAt));
  const [passwordAction, setPasswordAction] = useState<'keep' | 'set' | 'remove'>('keep'),
    [password, setPassword] = useState(''),
    [failure, setFailure] = useState(''),
    [notice, setNotice] = useState(''),
    [reading, setReading] = useState(false);
  return (
    <DialogSurface
      triggerLabel={t('files.collaboration.settings')}
      title={t('files.collaboration.settings')}
      description={share.title || share.name}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.collaboration.save')}
      confirmDisabled={
        reading || !sharePermissionsValid(permissions) || !shareAudienceValid(audience)
      }
      failureMessage={failure}
      onConfirm={async () => {
        const resolved = resolveShareExpiry(expiry, current.expiresAt);
        if (!resolved.ok) {
          setFailure(t('files.time.' + resolved.code));
          throw new FilesError('invalid');
        }
        try {
          const expiresAt = resolved.value;
          if (!expiresAt) throw new FilesError('invalid');
          await port.updateShare(current, {
            audience,
            title,
            permissions,
            expiresAt,
            passwordAction,
            password,
          });
          setPassword('');
          onSaved();
        } catch (error) {
          setFailure(t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`));
          throw error;
        }
      }}
    >
      <div className="space-y-4">
        <TextField
          label={t('files.collaboration.title')}
          hint={t('files.collaboration.titleHint')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <SharePermissionFields
          value={permissions}
          onChange={setPermissions}
          rootKind={share.kind ?? 'unavailable'}
        />
        <Suspense fallback={<p role="status">{t('files.access.loading')}</p>}>
          <ShareAudienceFields
            value={audience}
            onChange={setAudience}
            rootKind={share.kind === 'file' ? 'file' : 'folder'}
          />
        </Suspense>
        <ShareExpiryFields value={expiry} onChange={setExpiry} current={current.expiresAt} />
        <SelectField
          label={t('files.collaboration.passwordAction')}
          value={passwordAction}
          onValueChange={(value) => {
            setPasswordAction(value as typeof passwordAction);
            setPassword('');
          }}
          options={(['keep', 'set', 'remove'] as const).map((value) => ({
            value,
            label: t(`files.collaboration.passwordActions.${value}`),
          }))}
        />
        {passwordAction === 'set' ? (
          <PasswordField
            label={t('files.sharePassword')}
            hint={t('files.sharePasswordHint')}
            purpose="new"
            showLabel={t('files.showPassword')}
            hideLabel={t('files.hidePassword')}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        ) : null}
        <p className="text-sm text-ink-muted">{t('files.collaboration.invalidateHint')}</p>
        <Action
          variant="quiet"
          disabled={reading}
          onPress={() => {
            setReading(true);
            setNotice('');
            void port
              .readShare(share.id)
              .then((value) => {
                setCurrent(value);
                setNotice(t('files.collaboration.latestRead'));
                setFailure('');
              })
              .catch((error: unknown) =>
                setFailure(
                  t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
                ),
              )
              .finally(() => setReading(false));
          }}
        >
          {t('files.collaboration.readLatest')}
        </Action>
        {notice ? (
          <p role="status" className="text-sm text-ink-muted">
            {notice}
          </p>
        ) : null}
      </div>
    </DialogSurface>
  );
}
export function ShareDetailDrawer({
  share,
  onClose,
}: Readonly<{ share: FileShare; onClose(): void }>) {
  const port = useFiles(),
    { t } = useFrontendTranslation();
  const time = useFileTime();
  return (
    <DrawerSurface
      triggerLabel={t('files.collaboration.details')}
      title={share.title || share.name}
      description={t('files.collaboration.detailsHint')}
      closeLabel={t('files.close')}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="text-ink-muted">{t('files.collaboration.originalName')}</dt>
          <dd className="break-words">{share.name}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t('files.collaboration.state')}</dt>
          <dd>{t(`files.shareStatuses.${share.status}`)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t('files.collaboration.created')}</dt>
          <dd>{time.full(share.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t('files.shareExpires')}</dt>
          <dd>{time.full(share.expiresAt)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t('files.collaboration.permissions')}</dt>
          <dd className="mt-2 space-y-1">
            {(Object.keys(share.permissions) as (keyof SharePermissions)[])
              .filter((key) => share.permissions[key])
              .map((key) => (
                <p key={key}>{t(`files.collaboration.rights.${key}`)}</p>
              ))}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t('files.sharePassword')}</dt>
          <dd>
            {t(share.hasPassword ? 'files.shareProtected' : 'files.collaboration.noPassword')}
          </dd>
        </div>
      </dl>
      {share.status === 'active' ? (
        <a
          className="mt-5 inline-flex rounded-control border border-border px-4 py-2 text-sm font-semibold text-brand"
          href={port.shareLink(share.token)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('files.collaboration.visitorPreview')}
        </a>
      ) : null}
    </DrawerSurface>
  );
}
