'use client';
import { useEffect, useRef, useState } from 'react';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { SelectField } from '@clouddrive/ui-adapter/form-field';
import { DialogSurface } from '@clouddrive/ui-adapter/overlays';
import { useFiles } from '../../../src/files/runtime';
import { FilesError, type FileEntry } from '../../../src/files/model';
import {
  initialShareAudience,
  readOnlySharePermissions,
  shareAudienceValid,
  sharePermissionsValid,
  type SharePermissions,
} from '../../../src/files/sharing';
import type {
  AudienceTarget,
  EffectiveFileAccess,
  FileAccessDetail,
  FileAccessPolicy,
} from '../../../src/files/access';
import { AudienceTargetPicker, PermissionOverride, ShareAudienceFields } from './audience-fields';

export function FileAccessDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: FileEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const port = useFiles(),
    { t } = useFrontendTranslation();
  const [detail, setDetail] = useState<FileAccessDetail>(),
    [draft, setDraft] = useState<FileAccessPolicy | null>(null),
    [failure, setFailure] = useState(''),
    [notice, setNotice] = useState(''),
    [reading, setReading] = useState(true),
    [loadEpoch, setLoadEpoch] = useState(0);
  const [shareId, setShareId] = useState(''),
    [viewerKind, setViewerKind] = useState('anonymous'),
    [account, setAccount] = useState<AudienceTarget>(),
    [effective, setEffective] = useState<EffectiveFileAccess>(),
    [previewing, setPreviewing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const lifetime = useRef<AbortController | null>(null);
  const errorText = (error: unknown) =>
    t(
      error instanceof FilesError && error.code === 'conflict'
        ? 'files.access.draftConflict'
        : 'files.errors.' + (error instanceof FilesError ? error.code : 'unavailable'),
    );
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void port.access
      .read(entry.id, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setDetail(value);
        setDraft(value.policy);
        setShareId(value.shares[0]?.id ?? '');
        setLoadError('');
        setFailure('');
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(error instanceof FilesError ? error.code : 'unavailable');
      })
      .finally(() => {
        if (!controller.signal.aborted) setReading(false);
      });
    return () => {
      controller.abort();
      lifetime.current = null;
    };
  }, [entry.id, port, loadEpoch]);
  const draftValid =
    draft === null ||
    ((!Object.values(draft.default).some(Boolean) || sharePermissionsValid(draft.default)) &&
      shareAudienceValid(draft.audience));
  const rights = (permissions: SharePermissions) => (
    <ul className="flex flex-wrap gap-2 text-sm">
      {(Object.keys(permissions) as (keyof SharePermissions)[])
        .filter((key) => permissions[key])
        .map((key) => (
          <li className="rounded-control bg-canvas px-2 py-1" key={key}>
            {t('files.collaboration.rights.' + key)}
          </li>
        ))}
      {!Object.values(permissions).some(Boolean) ? <li>{t('files.access.none')}</li> : null}
    </ul>
  );
  return (
    <DialogSurface
      triggerLabel={t('files.access.title')}
      title={t('files.access.title')}
      description={detail?.entry.name ?? entry.name}
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      cancelLabel={t('files.cancel')}
      confirmLabel={t('files.access.save')}
      confirmDisabled={!detail || reading || !draftValid}
      onConfirm={async () => {
        if (!detail) throw new FilesError('unavailable');
        try {
          await port.access.update(entry.id, { revision: detail.revision, policy: draft });
          onSaved();
        } catch (error) {
          setFailure(errorText(error));
          throw error;
        }
      }}
    >
      <div className="min-w-0 space-y-4">
        {failure || loadError ? (
          <p role="alert" className="text-sm text-danger">
            {failure || t('files.errors.' + loadError)}
          </p>
        ) : null}
        {reading ? <p role="status">{t('files.access.loading')}</p> : null}
        {!detail && !reading ? (
          <Action
            variant="secondary"
            onPress={() => {
              setReading(true);
              setLoadEpoch((value) => value + 1);
            }}
          >
            {t('files.access.retry')}
          </Action>
        ) : null}
        {detail ? (
          <>
            <p className="text-sm text-ink-muted">{t('files.access.itemHint')}</p>
            <SelectField
              label={t('files.access.mode')}
              value={draft === null ? 'inherit' : 'independent'}
              onValueChange={(mode) =>
                setDraft(
                  mode === 'inherit'
                    ? null
                    : {
                        default: { ...readOnlySharePermissions },
                        audience: initialShareAudience(),
                      },
                )
              }
              options={[
                { value: 'inherit', label: t('files.access.inherited') },
                { value: 'independent', label: t('files.access.independent') },
              ]}
            />
            <p className="text-sm text-ink-muted">
              {detail.inheritedFrom
                ? t('files.access.source', { name: detail.inheritedFrom.name })
                : t('files.access.linkDefault')}
            </p>
            {draft ? (
              <>
                <PermissionOverride
                  label={t('files.access.base')}
                  value={draft.default}
                  onChange={(permissions) => {
                    if (permissions) setDraft({ ...draft, default: permissions });
                  }}
                  allowInherit={false}
                  rootKind={entry.kind === 'file' ? 'file' : 'folder'}
                  policyScope="entry"
                />
                <ShareAudienceFields
                  value={draft.audience}
                  onChange={(audience) => setDraft({ ...draft, audience })}
                  rootKind={entry.kind === 'file' ? 'file' : 'folder'}
                  policyScope="entry"
                />
              </>
            ) : (
              <p className="text-sm text-ink-muted">{t('files.access.inheritHint')}</p>
            )}
            <Action
              variant="quiet"
              disabled={reading}
              onPress={() => {
                setReading(true);
                setNotice('');
                void port.access
                  .read(entry.id, lifetime.current?.signal)
                  .then((value) => {
                    setDetail(value);
                    setEffective(undefined);
                    setNotice(t('files.access.latestRead'));
                    setFailure('');
                  })
                  .catch((error: unknown) => setFailure(errorText(error)))
                  .finally(() => setReading(false));
              }}
            >
              {t('files.access.latest')}
            </Action>
            {notice ? (
              <p role="status" className="text-sm">
                {notice}
              </p>
            ) : null}
            <section
              className="space-y-3 border-t border-border pt-4"
              aria-label={t('files.access.preview')}
            >
              <h3 className="font-semibold">{t('files.access.preview')}</h3>
              <p className="text-sm text-ink-muted">{t('files.access.previewHint')}</p>
              {detail.shares.length ? (
                <>
                  <SelectField
                    label={t('files.access.share')}
                    value={shareId}
                    onValueChange={(id) => {
                      setShareId(id);
                      setEffective(undefined);
                    }}
                    options={detail.shares.map((share) => ({
                      value: share.id,
                      label: share.title || share.rootName,
                    }))}
                  />
                  <SelectField
                    label={t('files.access.previewAs')}
                    value={viewerKind}
                    onValueChange={(kind) => {
                      setViewerKind(kind);
                      setAccount(undefined);
                      setEffective(undefined);
                    }}
                    options={[
                      { value: 'anonymous', label: t('files.access.anonymousViewer') },
                      { value: 'account', label: t('files.access.accountViewer') },
                    ]}
                  />
                  {viewerKind === 'account' ? (
                    <>
                      <AudienceTargetPicker
                        kind="account"
                        onSelect={(_, target) => {
                          setAccount(target);
                          setEffective(undefined);
                        }}
                      />
                      <p className="text-sm">
                        {account ? account.label : t('files.access.previewAccount')}
                      </p>
                    </>
                  ) : null}
                  <Action
                    variant="secondary"
                    disabled={previewing || !shareId || (viewerKind === 'account' && !account)}
                    onPress={() => {
                      setPreviewing(true);
                      setFailure('');
                      void port.access
                        .preview(
                          entry.id,
                          shareId,
                          viewerKind === 'account' ? (account?.id ?? '') : '',
                          lifetime.current?.signal,
                        )
                        .then(setEffective)
                        .catch((error: unknown) => setFailure(errorText(error)))
                        .finally(() => setPreviewing(false));
                    }}
                  >
                    {t('files.access.preview')}
                  </Action>
                  {effective ? (
                    <div role="status" className="space-y-2">
                      <p className="text-sm font-semibold">{t('files.access.effective')}</p>
                      {rights(effective.permissions)}
                      <p className="text-sm">
                        {effective.source
                          ? t('files.access.fromEntry', { name: effective.source.name })
                          : t('files.access.fromLink')}
                      </p>
                      <p className="text-sm">
                        {t('files.access.reason', {
                          reason: t('files.access.reasons.' + effective.reason),
                        })}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-ink-muted">{t('files.access.noShares')}</p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </DialogSurface>
  );
}
