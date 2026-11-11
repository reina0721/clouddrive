'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { MenuButton } from '@clouddrive/ui-adapter/menu-button';
import { StatusPill, type StatusTone } from '@clouddrive/ui-adapter/status-pill';
import { FileGlyph, MoreHorizontal } from '../../../src/files/icons';
import type { FileShare } from '../../../src/files/model';
import { sharePermissionPreset } from '../../../src/files/sharing';
import { shareAudienceChoice } from './share-audience-choice';
import { useFileTime } from './use-file-time';

export type ShareListAction = 'copy' | 'details' | 'settings' | 'pause' | 'resume' | 'revoke';
export type ShareListFeedback = Readonly<{ shareId: string; error: boolean; message: string }>;
const tones: Record<FileShare['status'], StatusTone> = {
  active: 'success',
  paused: 'warning',
  expired: 'neutral',
  revoked: 'neutral',
  unavailable: 'warning',
  limited: 'warning',
};

export function ShareListItem({
  share,
  opening,
  copying,
  feedback,
  visitorHref,
  onAction,
}: {
  share: FileShare;
  opening: boolean;
  copying: boolean;
  feedback: ShareListFeedback | undefined;
  visitorHref: string;
  onAction: (action: ShareListAction, share: FileShare) => void;
}) {
  const { t } = useFrontendTranslation();
  const time = useFileTime();
  const name = share.title || share.name || t('files.collaboration.unavailableName');
  const canToggle = share.status !== 'revoked' && share.status !== 'expired';
  const primarySettings =
    share.status !== 'active' &&
    share.status !== 'revoked' &&
    (share.status === 'expired' || share.enabled);
  const menuItems = [
    ...(share.status !== 'revoked' && !primarySettings
      ? [{ id: 'settings', label: t('files.collaboration.settings'), disabled: opening }]
      : []),
    ...(canToggle && share.enabled ? [{ id: 'pause', label: t('files.collaboration.pause') }] : []),
    ...(share.status !== 'revoked'
      ? [{ id: 'revoke', label: t('files.revokeShare'), tone: 'danger' as const }]
      : []),
  ];
  return (
    <li data-share-id={share.id} className="min-w-0 py-5">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-start gap-3 lg:flex-1">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-panel bg-surface-muted"
          >
            <FileGlyph kind={share.kind ?? 'file'} mediaType="" size="small" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="min-w-0 break-words text-base font-semibold">
                <button
                  type="button"
                  aria-label={t('files.collaboration.openDetails', { name })}
                  className="rounded-control text-left outline-none hover:text-brand focus-visible:ring-2 focus-visible:ring-focus-ring"
                  onClick={() => onAction('details', share)}
                >
                  {name}
                </button>
              </h2>
              <StatusPill tone={tones[share.status]}>
                {t(`files.shareStatuses.${share.status}`)}
              </StatusPill>
            </div>
            {share.title && share.name ? (
              <p className="mt-1 break-words text-sm text-ink-muted">{share.name}</p>
            ) : null}
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5 text-ink-muted">
              <span>
                {t(`files.collaboration.presets.${sharePermissionPreset(share.permissions)}`)}
              </span>
              <span>
                {t(`files.collaboration.audiences.${shareAudienceChoice(share.audience)}`)}
              </span>
              {share.hasPassword ? <span>{t('files.shareProtected')}</span> : null}
              <span>
                {t('files.shareExpires')}:{' '}
                <time dateTime={share.expiresAt}>{time.full(share.expiresAt)}</time>
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
          {share.status === 'active' ? (
            <>
              <Action
                variant="secondary"
                size="sm"
                disabled={copying}
                onPress={() => onAction('copy', share)}
              >
                {t('files.copyLink')}
              </Action>
              <a
                className="inline-flex min-h-control-sm items-center rounded-action px-3 text-sm font-medium text-brand outline-none hover:bg-brand/8 focus-visible:ring-2 focus-visible:ring-focus-ring"
                href={visitorHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('files.collaboration.visitorPreview')}
              >
                {t('files.collaboration.previewShort')}
              </a>
            </>
          ) : share.status !== 'revoked' && !share.enabled && canToggle ? (
            <Action variant="secondary" size="sm" onPress={() => onAction('resume', share)}>
              {t('files.collaboration.resume')}
            </Action>
          ) : share.status === 'expired' ||
            share.status === 'unavailable' ||
            share.status === 'limited' ? (
            <Action
              variant="secondary"
              size="sm"
              disabled={opening}
              onPress={() => onAction('settings', share)}
            >
              {t('files.collaboration.settings')}
            </Action>
          ) : null}
          {menuItems.length ? (
            <MenuButton
              ariaLabel={t('files.collaboration.actionsFor', { name })}
              label={<MoreHorizontal className="size-5" aria-hidden="true" />}
              triggerVariant="icon"
              triggerSize="sm"
              items={menuItems}
              onAction={(id) => onAction(id as ShareListAction, share)}
            />
          ) : null}
        </div>
      </div>
      {share.status !== 'active' ? (
        <p className="mt-2 text-xs leading-5 text-ink-muted lg:pl-13">
          {t(`files.collaboration.statusHints.${share.status}`)}
        </p>
      ) : null}
      {opening ? (
        <p role="status" className="mt-3 text-sm text-ink-muted">
          {t('files.collaboration.openingSettings')}
        </p>
      ) : null}
      {feedback ? (
        <p
          className={`mt-3 text-sm ${feedback.error ? 'text-danger' : 'text-ink-muted'}`}
          role={feedback.error ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      ) : null}
    </li>
  );
}
