'use client';
import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { PasswordField, TextField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { DisclosurePanel } from '@clouddrive/ui-adapter/disclosure';
import { DescriptionList } from '@clouddrive/ui-adapter/description-list';
import { Share2 } from '../../../src/files/icons';
import { shareAudienceChoice } from './share-audience-choice';
import { useFiles } from '../../../src/files/runtime';
import { FilesError, type FileEntry, type FileShare } from '../../../src/files/model';

import { SharePermissionFields, ShareExpiryFields } from './share-settings-fields';
import { initialShareExpiry, resolveShareExpiry } from './share-expiry';
import { useFileTime } from './use-file-time';
import {
  readOnlySharePermissions,
  sharePermissionPreset,
  initialShareAudience,
  shareAudienceValid,
  sharePermissionsValid,
  type SharePermissions,
} from '../../../src/files/sharing';
const ShareAudienceFields = lazy(() =>
  import('./audience-fields').then((module) => ({ default: module.ShareAudienceChoiceFields })),
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
  const formId = useId();
  const submitting = useRef(false);
  const errorTarget = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (failure) errorTarget.current?.focus();
  }, [failure]);
  const errorText = (error: unknown) =>
    t(`files.errors.${error instanceof FilesError ? error.code : 'unavailable'}`);
  const failureNotice = failure ? (
    <p
      ref={errorTarget}
      tabIndex={-1}
      role="alert"
      className="text-sm text-danger outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      {failure}
    </p>
  ) : null;
  return (
    <DialogSurface
      triggerLabel={t('files.share')}
      title={t('files.share')}
      description={entry.name}
      cancelLabel={t('files.close')}
      busy={busy}
      footerAction={
        created ? (
          <Action
            onPress={() => {
              setFailure('');
              setCopied(false);
              void port
                .copyShareLink(created.token)
                .then(() => setCopied(true))
                .catch((error: unknown) => setFailure(errorText(error)));
            }}
          >
            {t(copied ? 'files.linkCopied' : 'files.copyLink')}
          </Action>
        ) : (
          <Action
            form={formId}
            type="submit"
            loading={busy}
            disabled={busy || !sharePermissionsValid(permissions) || !shareAudienceValid(audience)}
          >
            {t('files.createShare')}
          </Action>
        )
      }
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {created ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3" role="status">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-action bg-brand-soft text-brand"
              aria-hidden="true"
            >
              <Share2 className="size-5" />
            </span>
            <h3 className="text-base font-semibold">{t('files.collaboration.linkReady')}</h3>
          </div>
          <a
            href={port.shareLink(created.token)}
            target="_blank"
            rel="noopener noreferrer"
            className="block break-all rounded-control bg-surface-muted p-3 text-sm leading-6 text-brand underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            {port.shareLink(created.token)}
          </a>
          <DescriptionList
            label={t('files.collaboration.details')}
            items={[
              {
                id: 'audience',
                term: t('files.collaboration.audienceChoice'),
                description: t(
                  `files.collaboration.audiences.${shareAudienceChoice(created.audience)}`,
                ),
              },
              {
                id: 'permissions',
                term: t('files.collaboration.permissions'),
                description: t(
                  `files.collaboration.presets.${sharePermissionPreset(created.permissions)}`,
                ),
              },
              {
                id: 'expires',
                term: t('files.shareExpires'),
                description: time.full(created.expiresAt),
              },
              {
                id: 'password',
                term: t('files.collaboration.passwordStatus'),
                description: t(
                  created.hasPassword ? 'files.shareProtected' : 'files.collaboration.noPassword',
                ),
              },
            ]}
            columns={2}
          />
          <p className="text-sm leading-6 text-ink-muted">
            {t(created.hasPassword ? 'files.collaboration.passwordReminder' : 'files.shareCreated')}
          </p>
          {failureNotice}
        </div>
      ) : (
        <form
          id={formId}
          className="space-y-5"
          aria-busy={busy || undefined}
          onSubmit={(event) => {
            event.preventDefault();
            if (submitting.current) return;
            submitting.current = true;
            setBusy(true);
            setFailure('');
            const resolved = resolveShareExpiry(expiry);
            if (!resolved.ok) {
              setFailure(t('files.time.' + resolved.code));
              setBusy(false);
              submitting.current = false;
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
              .finally(() => {
                submitting.current = false;
                setBusy(false);
              });
          }}
        >
          <fieldset disabled={busy} className="min-w-0 space-y-5">
            <Suspense fallback={<p role="status">{t('files.access.loading')}</p>}>
              <ShareAudienceFields
                value={audience}
                onChange={setAudience}
                rootKind={entry.kind === 'file' ? 'file' : 'folder'}
              />
            </Suspense>
            <SharePermissionFields
              value={permissions}
              onChange={setPermissions}
              rootKind={entry.kind}
            />
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
            <DisclosurePanel title={t('files.collaboration.optionalTitle')}>
              <TextField
                label={t('files.collaboration.title')}
                hint={t('files.collaboration.titleHint')}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </DisclosurePanel>
          </fieldset>
          {failureNotice}
        </form>
      )}
    </DialogSurface>
  );
}
