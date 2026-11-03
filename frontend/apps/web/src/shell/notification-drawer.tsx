'use client';
import { CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatRelativeTime, formatTimeOfDay, useFrontendTranslation } from '@clouddrive/i18n';
import { Action } from '@clouddrive/ui-adapter/action';
import { StatusPill } from '@clouddrive/ui-adapter/status-pill';
import { DrawerSurface } from '@clouddrive/ui-adapter/overlays';
import type { useProductInbox } from '@clouddrive/surface/identity/runtime';
import { proceedAfterLeaveConfirm } from '../host/leave-confirm';
import { routeTargetResolver } from '../host/route-target-resolver';
import { useShellStore } from '../state/use-shell-store';
function relativeCaption(locale: string, createdAt: number): string {
  const diffMs = Date.now() - createdAt;
  const minutes = Math.max(0, Math.round(diffMs / 60_000));
  if (minutes < 60) return formatRelativeTime(locale, -minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatRelativeTime(locale, -hours, 'hour');
  return formatRelativeTime(locale, -Math.floor(hours / 24), 'day');
}

export function NotificationDrawer({
  open,
  setOpen,
  inbox,
}: Readonly<{
  open: boolean;
  setOpen: (open: boolean) => void;
  inbox: ReturnType<typeof useProductInbox>;
}>) {
  const router = useRouter();
  const { t, locale } = useFrontendTranslation();
  const { items, unread } = inbox;
  const unreadReminder = useShellStore((state) => state.preferences.notifications.unreadReminder);
  const localeRegion = useShellStore((state) => state.preferences.localeRegion);
  const markAllRead = () => {
    void inbox.markAllRead();
  };
  return (
    <DrawerSurface
      closeLabel={t('shell.closeNotifications')}
      description={t('shell.notificationCenterDescription')}
      isOpen={open}
      onOpenChange={setOpen}
      title={t('shell.notificationCenter')}
      triggerLabel=""
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-ink-muted">
            {t('shell.unreadCount', { count: unread })}
          </span>
          <Action
            leadingIcon={<CheckCheck className="size-4" aria-hidden="true" />}
            loading={inbox.pending}
            disabled={Boolean(inbox.error)}
            onPress={unread > 0 ? markAllRead : inbox.reload}
            size="sm"
            variant="secondary"
          >
            {t(unread > 0 ? 'shell.markAllRead' : 'identityProduct.refresh')}
          </Action>
        </div>
        {inbox.error || inbox.failure ? (
          <p role="alert" className="text-sm text-danger">
            {t(`identityProduct.errors.${(inbox.error ?? inbox.failure)?.code}`)}
          </p>
        ) : null}
        {inbox.loading ? (
          <p role="status" className="text-sm text-ink-muted">
            {t('identityProduct.loading')}
          </p>
        ) : null}
        <Action
          variant="secondary"
          onPress={() => {
            const href = routeTargetResolver.resolveHref({
              routeId: 'notifications',
              params: {},
            });
            void proceedAfterLeaveConfirm(href).then((proceed) => {
              if (proceed) {
                setOpen(false);
                router.push(href);
              }
            });
          }}
        >
          {t('management.viewAll')}
        </Action>
        {inbox.error ? (
          <Action variant="quiet" onPress={inbox.reload}>
            {t('identityProduct.retry')}
          </Action>
        ) : null}
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">{t('shell.noNotifications')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.slice(0, 10).map((item) => (
              <li key={item.id}>
                <button
                  className={`w-full rounded-panel border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-muted ${item.read || !unreadReminder ? '' : 'border-brand/40 bg-brand-soft/60'}`}
                  onClick={() => {
                    if (!item.read) void inbox.markRead([item.id]);
                    const href = routeTargetResolver.resolveHref({
                      routeId: 'notifications.detail',
                      params: {},
                      query: { id: item.id },
                    });
                    void proceedAfterLeaveConfirm(href).then((proceed) => {
                      if (proceed) {
                        setOpen(false);
                        router.push(href);
                      }
                    });
                  }}
                  type="button"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{item.title}</span>
                    <StatusPill tone={item.category === 'failure' ? 'danger' : 'neutral'}>
                      {t(`shell.notificationCategory.${item.category}`)}
                    </StatusPill>
                  </span>
                  {item.description ? (
                    <span className="mt-0.5 block text-xs leading-5 text-ink-muted">
                      {item.description}
                    </span>
                  ) : null}
                  {!item.read && unreadReminder ? (
                    <span className="mt-1 block text-xs font-bold uppercase tracking-wider text-brand">
                      {t('shell.notificationNow')}
                    </span>
                  ) : null}
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {localeRegion.relativeTime === 'relative'
                      ? relativeCaption(locale, item.createdAt)
                      : formatTimeOfDay(
                          locale,
                          {
                            timeZone: localeRegion.timeZone,
                            hourCycle: localeRegion.hourCycle,
                            showSeconds: localeRegion.showSeconds,
                          },
                          item.createdAt,
                        )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DrawerSurface>
  );
}
