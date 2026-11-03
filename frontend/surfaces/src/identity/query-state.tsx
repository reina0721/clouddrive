'use client';
import { useFrontendTranslation } from '@clouddrive/i18n';
import { NavigationIcon } from '@clouddrive/surface/icon-presentation';
import { Skeleton } from '@clouddrive/ui-adapter/skeleton';
import { StateSurface } from '@clouddrive/ui-adapter/state-surface';
import { route, RouteLink } from '@clouddrive/plugin-framework/plugin';
import type { IdentityError } from './model';
import { Action } from '@clouddrive/ui-adapter/action';

export function IdentityQueryState({
  error,
  retry,
}: Readonly<{ error: IdentityError | null; retry: () => void }>) {
  const { t } = useFrontendTranslation();
  if (!error)
    return (
      <div role="status" aria-label={t('identityProduct.loading')} className="grid gap-4 p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <span className="sr-only">{t('identityProduct.loading')}</span>
      </div>
    );
  return (
    <>
      <StateSurface
        state={
          error.code === 'forbidden'
            ? 'permission-denied'
            : error.code === 'network'
              ? 'offline'
              : 'error'
        }
        icon={<NavigationIcon iconId="identity" />}
        title={t(`identityProduct.errors.${error.code}`)}
        description={
          error.reason
            ? t(`identityProduct.reasons.${error.reason}`)
            : error.code === 'forbidden'
              ? t('identityProduct.permissionDescription')
              : t('identityProduct.unknown')
        }
        announcement="urgent"
        actionLabel={t('identityProduct.retry')}
        onAction={retry}
      />
      {error.code === 'forbidden' || error.code === 'not-found' ? (
        <div className="p-5">
          <RouteLink target={route('account')}>{t('identityProduct.back')}</RouteLink>
        </div>
      ) : null}
    </>
  );
}
export function IdentityModeNotice({ mode }: Readonly<{ mode: 'mock' | 'backend' }>) {
  const { t } = useFrontendTranslation();
  return (
    <div className="flex items-center gap-2 rounded-control border border-border/60 bg-surface-muted/40 px-3 py-1.5 text-xs text-ink-muted">
      <span className="size-1.5 rounded-full bg-brand" />
      <span>{t(`identityProduct.${mode}`)}</span>
    </div>
  );
}

export function IdentityEmptyState({
  title,
  description,
  onClear,
  clearLabel,
}: Readonly<{
  title: string;
  description: string;
  onClear?: (() => void) | undefined;
  clearLabel?: string | undefined;
}>) {
  return (
    <StateSurface
      state="empty"
      icon={<NavigationIcon iconId="identity" />}
      title={title}
      description={description}
      {...(onClear && clearLabel ? { actionLabel: clearLabel, onAction: onClear } : {})}
    />
  );
}
export function IdentityMutationError({
  error,
  reload,
}: Readonly<{ error: IdentityError | null; reload?: () => void }>) {
  const { t } = useFrontendTranslation();
  if (!error) return null;
  return (
    <div
      role="alert"
      className="grid gap-2 rounded-panel border border-border bg-danger-soft p-4 text-sm text-danger"
    >
      <p>
        {error.reason
          ? t('identityProduct.failureWithReason', {
              error: t(`identityProduct.errors.${error.code}`),
              reason: t(`identityProduct.reasons.${error.reason}`),
            })
          : t(`identityProduct.errors.${error.code}`)}
      </p>
      {error.requestId ? (
        <p className="break-words">{t('identityProduct.requestId', { id: error.requestId })}</p>
      ) : null}
      {error.reason === 'stale-version' && reload ? (
        <Action variant="secondary" size="sm" onPress={reload}>
          {t('identityProduct.refresh')}
        </Action>
      ) : null}
    </div>
  );
}
