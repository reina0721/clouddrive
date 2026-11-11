'use client';
import { lazy, Suspense, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { useFileTime } from './use-file-time';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { shareAudienceChoice } from './share-audience-choice';
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
  import('./audience-fields').then((module) => ({ default: module.ShareAudienceChoiceFields })),
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
  const [copied, setCopied] = useState(false);
  const [failure, setFailure] = useState('');
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
      <DescriptionList
        label={t('files.collaboration.details')}
        items={[
          { id: 'name', term: t('files.collaboration.originalName'), description: share.name },
          {
            id: 'state',
            term: t('files.collaboration.state'),
            description: t(`files.shareStatuses.${share.status}`),
          },
          {
            id: 'audience',
            term: t('files.collaboration.audienceChoice'),
            description: t(`files.collaboration.audiences.${shareAudienceChoice(share.audience)}`),
          },
          {
            id: 'created',
            term: t('files.collaboration.created'),
            description: time.full(share.createdAt),
          },
          { id: 'expires', term: t('files.shareExpires'), description: time.full(share.expiresAt) },
          {
            id: 'permissions',
            term: t('files.collaboration.permissions'),
            description: (
              <ul className="space-y-1">
                {(Object.keys(share.permissions) as (keyof SharePermissions)[])
                  .filter((key) => share.permissions[key])
                  .map((key) => (
                    <li key={key}>{t(`files.collaboration.rights.${key}`)}</li>
                  ))}
              </ul>
            ),
          },
          {
            id: 'password',
            term: t('files.collaboration.passwordStatus'),
            description: t(
              share.hasPassword ? 'files.shareProtected' : 'files.collaboration.noPassword',
            ),
          },
        ]}
      />
      {failure ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {failure}
        </p>
      ) : null}
      {share.status === 'active' ? (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Action
            onPress={() => {
              setFailure('');
              setCopied(false);
              void port
                .copyShareLink(share.token)
                .then(() => setCopied(true))
                .catch((error: unknown) =>
                  setFailure(
                    t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`),
                  ),
                );
            }}
          >
            {t(copied ? 'files.linkCopied' : 'files.copyLink')}
          </Action>
          <a
            className="inline-flex min-h-control items-center rounded-action px-3 text-sm font-medium text-brand outline-none hover:bg-brand/8 focus-visible:ring-2 focus-visible:ring-focus-ring"
            href={port.shareLink(share.token)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('files.collaboration.visitorPreview')}
          </a>
        </div>
      ) : null}
    </DrawerSurface>
  );
}
